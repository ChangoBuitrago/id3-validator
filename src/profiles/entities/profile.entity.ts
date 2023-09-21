import { ApiProperty } from '@nestjs/swagger';

/**
 * Represents a user profile with cross-referenced social links.
 */
export class Profile {
  /**
   * List of cross-referenced social links associated with this profile.
   * @type {Record<string, string>}
   * @example {
   *   email: 'username@email.com',
   *   youtube: 'https://www.youtube.com/username',
   *   twitter: 'https://twitter.com/username',
   *   linkedin: 'https://linkedin.com/in/username',
   *   github: 'https://github.com/username',
   * }
   */
  @ApiProperty({
    description: 'List of cross-referenced social links associated with this profile.',
    type: 'object',
    additionalProperties: {
      type: 'string',
    },
    example: {
      email: 'username@email.com',
      youtube: 'https://www.youtube.com/username',
      twitter: 'https://twitter.com/username',
      linkedin: 'https://linkedin.com/in/username',
      github: 'https://github.com/username',
    },
  })
  links: Record<string, string>;
}
