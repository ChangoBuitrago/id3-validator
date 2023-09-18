import { Body, Controller, Get, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiResponse,
  ApiTags
} from '@nestjs/swagger';
import { VerifyProfileDto } from './dto/verify-profile.dto';
import { Profile } from './entities/profile.entity';
import { ProfilesService } from './profiles.service';

@ApiBearerAuth()
@ApiTags('profiles')
@Controller('profiles')
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  @Get('healthCheck')
  @ApiResponse({
    status: 200,
    description: 'Successful health check',
    type: Boolean,
  })
  healthCheck(): boolean {
    return this.profilesService.healthCheck();
  }
    
  @Post('verifyProfile')
  @ApiBody({ type: VerifyProfileDto })
  @ApiResponse({
    status: 200,
    description: 'Result of profile verification',
    type: Profile,
  })
  verifyProfile(
    @Body() verifyProfileDto: VerifyProfileDto,
  ): Promise<Profile> {
    return this.profilesService.verifyProfile(verifyProfileDto);
  }
}