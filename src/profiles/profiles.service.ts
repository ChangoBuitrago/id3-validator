/**
 * Import statements for the required modules.
 */
import * as Kilt from '@kiltprotocol/sdk-js';
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import fetch from 'node-fetch';
import { VerifyProfileDto } from './dto/verify-profile.dto';
import { Profile } from './entities/profile.entity';
import { supportedPlatforms } from '../local/supportedPlatforms.json'

/**
 * Service for managing user profiles and credentials.
 *
 * This service provides methods for retrieving, verifying, and managing user credentials and profiles.
 * It also handles initialization and cleanup of resources during the lifecycle of the module.
 */
@Injectable()
export class ProfilesService implements OnModuleInit, OnModuleDestroy {
  /**
   * Constructor for ProfilesService.
   * @param configService - Instance of ConfigService for configuration.
   */
  constructor(private readonly configService: ConfigService) {}

  /**
   * Logger instance for logging.
   */
  private readonly logger = new Logger(ProfilesService.name);

  /**
   * Lifecycle hook when the module initializes.
   */
  async onModuleInit() {
    const wssAddress = this.configService.get<string>('KILT_WSS_ADDRESS', '');
    await Kilt.connect(wssAddress);
  }

  /**
   * Lifecycle hook when the module is destroyed.
   */
  async onModuleDestroy() {
    await Kilt.disconnect();
  }

  /**
   * Health check function.
   * @returns {boolean} - Indicates the health status.
   */
  healthCheck(): boolean {
    return true;
  }

  /**
   * Checks if the input JSON is a valid KiltPublishedCredentialCollectionV1.
   * @param json - Input JSON to be checked.
   * @returns {boolean} - Indicates if the JSON is a valid KiltPublishedCredentialCollectionV1.
   */
  isPublishedCollection(json: unknown): json is Kilt.KiltPublishedCredentialCollectionV1 {
    return (
      Array.isArray(json) &&
      json.length > 0 &&
      json.every(
        (item) => item && item['credential'] && Kilt.Credential.isICredential(item['credential'])
      )
    );
  }

  /**
   * Retrieves a DID URI by Web3Name.
   * @param web3Name - Web3Name to query.
   * @returns {Promise<Kilt.DidUri>} - A promise that resolves to the retrieved DID URI.
   */
  async getDidUriByWeb3Name(web3Name: Kilt.Did.Web3Name): Promise<Kilt.DidUri> {
    try {
      const api = Kilt.ConfigService.get('api');
      const encodedDidForWeb3Name = await api.call.did.queryByWeb3Name(web3Name);
      const { document: { uri: didUri } } = Kilt.Did.linkedInfoFromChain(encodedDidForWeb3Name);
      return didUri;
    } catch (error) {
      throw new Error(`[${this.getDidUriByWeb3Name.name}] - ${error.message}`);
    }
  }

  /**
   * Fetches credentials from an endpoint.
   * @param endpoint - The endpoint to fetch credentials from.
   * @returns {Promise<Kilt.KiltPublishedCredentialCollectionV1>} - A promise that resolves to an array of credentials.
   */
  async fetchCredentials(endpoint: string): Promise<Kilt.KiltPublishedCredentialCollectionV1> {
    try {
      const response = await fetch(endpoint);
      if (!response.ok) {
        throw new Error(`Failed to fetch credentials for endpoint ${endpoint}. Status code: ${response.status}`);
      }
      const jsonCollection = await response.json();
      if (!this.isPublishedCollection(jsonCollection)) {
        throw new Error(`Collection is not a valid KiltPublishedCredentialCollectionV1 type`);
      }
      return jsonCollection as Kilt.KiltPublishedCredentialCollectionV1;
    } catch (error) {
      throw new Error(`[${this.fetchCredentials.name}] - ${error.message}`);
    }
  }

  /**
   * Verifies a credential.
   * @param credential - The credential to be verified.
   * @param {Kilt.DidUri[]} trustedAttesterUris - An array of trusted attester URIs.
   * @param didUri - The DID URI to be used for verification.
   * @param ctype - The credential type (optional).
   * @returns {Promise<Kilt.ICredential>} - A promise that resolves to the verified credential.
   */
  async verifyCredential(
    credentialV1: Kilt.KiltPublishedCredentialV1,
    trustedAttesterUris: Kilt.DidUri[] = [],
    didUri: Kilt.DidUri,
  ): Promise<Kilt.KiltPublishedCredentialV1> {
    try {
      // Extract credential from KiltPublishedCredentialV1 type
      const { credential } = credentialV1

      // Get cType registered on-chain
      const { cType:ctype } = await Kilt.CType.fetchFromChain(`kilt:ctype:${credential.claim.cTypeHash}`)

      // Verifies the validity of the credential.
      const { revoked, attester } = await Kilt.Credential.verifyCredential(credential, { ctype });

      // Verify that the credential is not revoked.
      if (revoked) {
        throw new Error('One of the credentials has been revoked, hence it is not valid.');
      }

      if (!trustedAttesterUris.includes(attester)) {
        throw `Credential was issued by ${attester} which is not in the provided list of trusted attesters: ${trustedAttesterUris}.`;
      }

      // Verify that the credential refers to the intended subject.
      if (!Kilt.Did.isSameSubject(credential.claim.owner, didUri)) {
        throw new Error('Credential refers to a different subject than expected.');
      }

      return credentialV1;
    } catch (error) {
      throw new Error(`[${this.verifyCredential.name}] - ${error.message}`);
    }
  }

  /**
   * Verifies an array of social credentials.
   * @param socialCredentials - Array of social credentials to be verified.
   * @param {Kilt.DidUri[]} trustedAttesterUris - An array of trusted attester URIs.
   * @param didUri - The DID URI to be used for verification.
   * @returns {Promise<Kilt.ICredential[]>} - A promise that resolves to an array of verified credentials.
   */
  async verifySocialCredentials(
    socialCredentials: Kilt.KiltPublishedCredentialCollectionV1,
    trustedAttesterUris: Kilt.DidUri[],
    didUri: Kilt.DidUri
  ): Promise<Kilt.KiltPublishedCredentialCollectionV1> {
    // Verify a social credential using provided information
    const verifiedCredentialsPromises = socialCredentials.map(async (credentialV1) => {
      try {
        // Verify the credential
        return this.verifyCredential(
          credentialV1, 
          trustedAttesterUris, 
          didUri, 
        );
      } catch (error) {
        return error; // Handle failed verification
      }
    });

    const verifiedCredentialsResults = await Promise.allSettled(verifiedCredentialsPromises);

    const successfulVerifications = verifiedCredentialsResults
      .filter(result => result.status === 'fulfilled')
      .map(result => (result as PromiseFulfilledResult<Kilt.KiltPublishedCredentialV1>).value);

    return successfulVerifications;
  }

  /**
   * Extracts profile information from an array of credentials.
   * @param credentialsv1 - Array of KiltPublishedCredentialV1 credentials.
   * @returns {Profile} - The extracted profile.
   */
  extractProfile(credentialsV1: Kilt.KiltPublishedCredentialCollectionV1): Profile {
    const links: Record<string, string> = {};

    credentialsV1.forEach(({ credential }) => {
      const { name, contentsKey, linkTemplate} = supportedPlatforms.find(({ cTypeHash }) => credential.claim.cTypeHash === cTypeHash)

      links[name] = linkTemplate.replace("CONTENTS_VALUE", credential.claim.contents[contentsKey] as string)
    });

    return { links };
  }

  /**
   * Verifies a user profile.
   * @param {VerifyProfileDto} params - Object containing web3Name, username, and platform.
   * @returns {Promise<Profile>} - A promise that resolves to the verified profile.
   */
  async verifyProfile({ web3Name, username, platform }: VerifyProfileDto): Promise<Profile> {
    try {
      if (!web3Name || !username || !platform) {
        throw new Error('Invalid parameters: web3Name, username, and platform are required.')
      }

      // Get trusted attester URIs
      const trustedAttesterUris = this.configService.get<string>('TRUSTED_ATTESTER_URIS', '').split(',') as Kilt.DidUri[]
      if (!trustedAttesterUris.length) {
        throw new Error('No trusted attester URIs found')
      }

      // Check if supported platform list is empty
      if (!supportedPlatforms.length) {
        throw new Error('No supported platform list found')
      }

      // Check if the provided platform is supported
      const matchingPlatform = supportedPlatforms.some(({ name }) => platform === name)
      if (!matchingPlatform) {
        throw new Error(`The provided platform (${platform}) is not supported.`)
      }

      // Get the DidUri for the provided web3Name
      const didUri = await this.getDidUriByWeb3Name(web3Name)
      if (!didUri) {
        throw new Error(`No DidUri found for the provided web3Name: ${web3Name}`)
      }

      // Resolve the provided DidUri to retrieve DID information
      const resolutionResult = await Kilt.Did.resolve(didUri)
      if (!resolutionResult) {
        throw new Error('The provided DID does not exist on the KILT blockchain.')
      }
            
      // If no details are returned but resolutionResult is not null, the DID has been deleted.
      // This information is present in `resolutionResult.metadata.deactivated`.
      const { document } = resolutionResult
      if (!document) {
        throw new Error('The requested DID has already been deleted.')
      }

      // Filter the endpoint by KiltPublishedCredentialCollectionV1Type type.
      const credentialEndpoints = document.service?.filter(service => service.type.includes(Kilt.KiltPublishedCredentialCollectionV1Type))
      if (!credentialEndpoints?.length) {
        throw new Error(`No endpoints were found in the document`)
      }
      if (credentialEndpoints.length > 1) {
        throw new Error(`Multiple endpoints were found in the document`)
      }

      // Get the first endpoint from credentialEndpoints
      const [firstEndpoint] = credentialEndpoints
      // Fetch credentials from the service endpoint
      const credentials = await this.fetchCredentials(firstEndpoint.serviceEndpoint[0])

      // Destructuring `cTypeHash` and `contentsKey` from matching platform
      const { cTypeHash, contentsKey } = supportedPlatforms.find(({ name }) => name === platform)
      // Find the matching credentials for the provided platform and username
      const matchingCredential = credentials.find(({ credential }) => 
          credential.claim.cTypeHash === cTypeHash
            && (contentsKey in credential.claim.contents)
              && credential.claim.contents[contentsKey] === username)
      if (!matchingCredential) {
        throw new Error(`No matching credential found for platform "${platform}" and username "${username}".`)
      }

      // Verify the matching credential first, before proceeding with the rest of the social credential list
      this.verifyCredential(matchingCredential, trustedAttesterUris, didUri)
      
      // Filter credentials from KiltPublishedCredentialCollection based on supported CTypes
      const socialCredentials = credentials.filter(({ credential }) =>
        supportedPlatforms.some(({ cTypeHash }) => credential.claim.cTypeHash === cTypeHash)
      )

      // Verify social credentials and get only successful verifications
      const successfulVerifications = await this.verifySocialCredentials(
        socialCredentials,
        trustedAttesterUris,
        didUri
      )

      // Extract and return the profile from verified credentials
      const profile: Profile = this.extractProfile(successfulVerifications)
      return profile

    } catch (error) {
      // Log the error
      this.logger.error(error.message)
    }
  }
}