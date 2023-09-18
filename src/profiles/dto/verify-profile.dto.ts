import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class VerifyProfileDto {
  @IsString()
  @ApiProperty({
    description: 'The web3name for profile verification.',
    example: 'micha',
  })
  readonly web3Name: string;

  @IsString()
  @ApiProperty({
    description: 'The username for profile verification.',
    example: 'drgorb',
  })
  readonly username: string;
  
  @IsString()
  @ApiProperty({
    description: 'The social media platform\'s name for profile verification.',
    example: 'twitter',
  })
  readonly platform: string;
}