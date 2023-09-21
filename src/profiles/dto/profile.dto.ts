import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

/**
 * Data Transfer Object for profile information.
 */
export class ProfileDto {
  /**
   * The web3name for profile verification.
   * @type {string}
   * @example 'buitrago'
   */
  @IsString()
  @ApiProperty({
    description: 'The web3name for profile verification.',
    example: 'buitrago',
  })
  readonly web3Name: string;

  /**
   * The username for profile verification.
   * @type {string}
   * @example 'briefboards'
   */
  @IsString()
  @ApiProperty({
    description: 'The username for profile verification.',
    example: 'briefboards',
  })
  readonly username: string;
  
  /**
   * The social media platform's name for profile verification.
   * @type {string}
   * @example 'twitter'
   */
  @IsString()
  @ApiProperty({
    description: 'The social media platform\'s name for profile verification.',
    example: 'twitter',
  })
  readonly platformName: string;
}
