import { ApiProperty } from '@nestjs/swagger';

export class Profile {
  @ApiProperty({
    description: 'List of cross-referenced social links associated with this profile.',
    type: 'object',
    additionalProperties: {
      type: 'string',
    },
    example: {
      email: 'example@email.com',
      website: 'https://example.com',
      twitter: 'https://twitter.com/example',
      linkedin: 'https://linkedin.com/in/example',
      github: 'https://github.com/example',
    },
  })
  links: Record<string, string>;
}