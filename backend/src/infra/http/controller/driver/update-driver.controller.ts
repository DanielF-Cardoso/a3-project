import {
  Body,
  Controller,
  Patch,
  UseGuards,
  BadRequestException,
  NotFoundException,
  ConflictException,
  Param,
} from '@nestjs/common'
import { JwtAuthGuard } from '@/infra/auth/jwt-auth.guard'
import { SameEmailError } from '@/core/errors/same-email.error'
import { I18nService } from 'nestjs-i18n'
import { ApiTags } from '@nestjs/swagger'
import { SamePhoneError } from '@/core/errors/same-phone.error'
import { UpdateDriverProfileService } from '@/domain/driver/application/services/update-driver-profile.service'
import { UpdateDriverDTO } from '../../dto/driver/update-driver.dto'
import { DriverPresenter } from '../../presenters/driver.presenter'
import { SameCnhError } from '@/domain/driver/application/services/errors/same-cnh.error.error'
import { ResourceNotFoundError } from '@/core/errors/resource-not-found.error'
import { UpdateDriverDocs } from '@/infra/docs/drivers/update-driver.doc'

@ApiTags('Motorista')
@Controller('drivers')
export class UpdateDriverController {
  constructor(
    private updateDriverProfileService: UpdateDriverProfileService,
    private readonly i18n: I18nService,
  ) {}

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @UpdateDriverDocs()
  async handle(@Body() body: UpdateDriverDTO, @Param('id') id: string) {
    const result = await this.updateDriverProfileService.execute({
      driverId: id,
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email,
      cnh: body.cnh,
      cnhType: body.cnhType,
      phone: body.phone,
      street: body.street,
      number: body.number,
      district: body.district,
      zipCode: body.zipCode,
      city: body.city,
      state: body.state,
    })

    if (result.isLeft()) {
      const error = result.value

      switch (error.constructor) {
        case ResourceNotFoundError:
          throw new NotFoundException(
            await this.i18n.translate('errors.manager.notFound'),
          )
        case SameEmailError:
          throw new ConflictException(
            await this.i18n.translate('errors.generic.sameEmail'),
          )
        case SamePhoneError:
          throw new ConflictException(
            await this.i18n.translate('errors.generic.samePhone'),
          )
        case SameCnhError:
          throw new ConflictException(
            await this.i18n.translate('errors.manager.alreadyExists'),
          )
        default:
          throw new BadRequestException(
            await this.i18n.translate('errors.generic.unexpectedError'),
          )
      }
    }

    return {
      driver: DriverPresenter.toHTTP(result.value.driver),
    }
  }
}
