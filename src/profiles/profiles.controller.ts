import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiResponse,
  ApiTags
} from '@nestjs/swagger';
import { ProfileDto } from './dto/profile.dto';
import { Profile } from './entities/profile.entity';
import { ProfilesService } from './profiles.service';

/**
 * Controller handling profile-related endpoints.
 */
@ApiBearerAuth()
@ApiTags('profiles')
@Controller('profiles')
export class ProfilesController {
  /**
   * Constructor to create an instance of ProfilesController.
   * @param profilesService The profiles service.
   */
  constructor(private readonly profilesService: ProfilesService) {}

  /**
   * Endpoint for performing a health check.
   * @returns {boolean} True if the health check is successful.
   */
  @Get('healthCheck')
  @ApiResponse({
    status: 200,
    description: 'Successful health check',
    type: Boolean,
  })
  healthCheck(): boolean {
    return this.profilesService.healthCheck();
  }
    
  /**
   * Endpoint for retrieving a profile.
   * @param {ProfileDto} profileDto - The profile DTO containing query parameters.
   * @returns {Promise<Profile>} The profile information.
   */
  @Get('getProfile')
  @ApiResponse({
    status: 200,
    description: 'Get profile',
    type: Profile,
  })
  getProfile(
    @Query() profileDto: ProfileDto,
  ): Promise<Profile> {
    return this.profilesService.getProfile(profileDto);
  }
}