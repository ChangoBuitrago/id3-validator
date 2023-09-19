import * as Kilt from '@kiltprotocol/sdk-js';
import { BadRequestException, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import fetch from 'node-fetch';
import { VerifyProfileDto } from './dto/verify-profile.dto';
import { Profile } from './entities/profile.entity';

@Injectable()
export class ProfilesService implements OnModuleInit, OnModuleDestroy {
  constructor(private readonly configService: ConfigService) {}
  
  private readonly logger = new Logger(ProfilesService.name)

  async onModuleInit() {
    const wssAddress = this.configService.get<string>('KILT_WSS_ADDRESS');
    await Kilt.connect(wssAddress);
  }
  
  async onModuleDestroy() {
    await Kilt.disconnect()
  }

  healthCheck(): boolean {
    return true;
  }

  async getDidUriByWeb3Name(
    web3Name: Kilt.Did.Web3Name
  ): Promise<Kilt.DidUri> {
    const api = Kilt.ConfigService.get('api')

    const encodedDidForWeb3Name = await api.call.did.queryByWeb3Name(web3Name);
    const { document: { uri: didUri } } = Kilt.Did.linkedInfoFromChain(encodedDidForWeb3Name);
  
    return didUri;
  }

  async verifyCredential(
    { credential }: Kilt.KiltPublishedCredentialV1,
    trustedAttesterUris: Kilt.DidUri[] = [],
    ctype: Kilt.ICType,
    didUri: Kilt.DidUri
  ): Promise<void> {
    // Verifies the validity of the credential.
    const { revoked, attester } = await Kilt.Credential.verifyCredential(credential, { ctype });

    // Verify that the credential is not revoked.
    if (revoked) {
      throw new Error('One of the credentials has been revoked, hence it is not valid.');
    }
  
    if (!trustedAttesterUris.includes(attester)) {
      throw `Credential was issued by ${attester} which is not in the provided list of trusted attesters: ${trustedAttesterUris}.`
    }

    // Verify that the credential refers to the intended subject.
    if (!Kilt.Did.isSameSubject(credential.claim.owner, didUri)) {
      throw new Error('Credential refers to a different subject than expected.');
    }

    this.logger.log('Valid credential 🎉')
  }

  async verifyProfile({ web3Name, username, platform }: VerifyProfileDto): Promise<Profile> {
    try {
      if (!web3Name || !username || !platform) {
        throw new BadRequestException('Invalid parameters: web3Name, username and platform are required.');
      }

      // Get DidUri for web3Name
      const didUri:Kilt.DidUri = await this.getDidUriByWeb3Name(web3Name)
      
      const resolutionResult = await Kilt.Did.resolve(didUri)
      if (!resolutionResult) {
        throw new Error('The DID does not exist on the KILT blockchain.')
      }

      // If no details are returned but resolutionResult is not null, the DID has been deleted.
      // This information is present in `resolutionResult.metadata.deactivated`.
      const { document } = resolutionResult
      if (!document) {
        throw new Error('The DID has already been deleted.')
      }

      // Filter the endpoints by KiltPublishedCredentialCollectionV1Type type.
      const credentialEndpoints: Kilt.DidServiceEndpoint[] = document.service?.filter((service) =>
        service.type.includes(Kilt.KiltPublishedCredentialCollectionV1Type)
      );
      if (!credentialEndpoints || credentialEndpoints.length === 0) {
        throw new Error(`No ${platform} service endpoints found in the document`);
      }
      
      // Being an IPFS endpoint, the fetching can take an arbitrarily long time or even fail if the timeout is reached.
      const credentialPromises = credentialEndpoints.map(async endpoint => {
        const response = await fetch(endpoint?.serviceEndpoint[0]);
        if (!response.ok) {
          throw new Error(`Failed to fetch credentials for endpoint ${endpoint?.serviceEndpoint[0]}. Status code: ${response.status}`);
        }
        return await response.json() as Kilt.KiltPublishedCredentialV1;
      });
      const credentials = (await Promise.all(credentialPromises)).flat();

      // console.log(JSON.stringify(credentials, null, 2))

      // Find a credential whose content matches the provided username
      const credential = credentials.find(({ credential }) => credential.claim.contents.Twitter === username)
      if (!credential) {
        throw new Error(`No matching credential found for the provided ${username}`);
      }
      
      // Fetch cType details from the chain using the provided cTypeId
      const cTypeId:`kilt:ctype:0x${string}` = this.configService.get<`kilt:ctype:0x${string}`>('TWITTER_CTYPE_ID')
      const { cType }:Kilt.CType.ICTypeDetails = await Kilt.CType.fetchFromChain(cTypeId)

      // Create an array of trusted attester URIs with the provided 'trustedAttester'
      const trustedAttesterUris:Kilt.DidUri[] = [this.configService.get<Kilt.DidUri>('TRUSTED_ATTESTER')]

      // Verify the credential using the provided information
      await this.verifyCredential(credential, trustedAttesterUris, cType, didUri)

      return {
        links: {
          email: 'mailto:micha.roon@managination.com',
          website: 'https://hashgraph-association.com',
          twitter: 'https://twitter.com/drgorb',
          linkedin: 'https://linkedin.com/in/micha',
          github: 'https://github.com/drgorb',
        },
      }

    } catch (error) {
      // Log the error
      this.logger.error(error.message)
    }
  }
}