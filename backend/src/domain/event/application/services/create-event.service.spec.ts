import { describe, it, expect, beforeEach, vi } from 'vitest'
import { CreateEventService } from './create-event.service'
import { I18nService } from 'nestjs-i18n'
import { InMemoryEventRepository } from 'test/repositories/in-memory-event.repository'
import { InMemoryCarRepository } from 'test/repositories/in-memory-car.repository'
import { InMemoryDriverRepository } from 'test/repositories/in-memory-driver.repository'
import { makeCar } from 'test/factories/car/make-car'
import { makeDriver } from 'test/factories/driver/make-driver'
import { makeEvent } from 'test/factories/event/make-event'
import { makeEventInput } from 'test/factories/event/make-event-input'
import { CarNotFoundError } from './errors/car-not-found.error'
import { DriverNotFoundError } from './errors/driver-not-found.error'
import { UniqueEntityID } from '@/core/entities/unique-entity-id'
import { InvalidOdometerError } from './errors/invalid-odometer.error'
import { CarInUseError } from './errors/car-in-use.error'
import { FakeLogger } from 'test/fake/logs-mocks'
import { InactiveCarError } from './errors/inactive-car.error'
import { InactiveDriverError } from './errors/inactive-driver.error'

let sut: CreateEventService
let eventRepository: InMemoryEventRepository
let carRepository: InMemoryCarRepository
let driverRepository: InMemoryDriverRepository
let i18n: I18nService
let logger: FakeLogger

beforeEach(() => {
  eventRepository = new InMemoryEventRepository()
  carRepository = new InMemoryCarRepository()
  driverRepository = new InMemoryDriverRepository()
  logger = new FakeLogger()

  i18n = {
    translate: vi.fn(),
  } as unknown as I18nService

  sut = new CreateEventService(
    eventRepository,
    carRepository,
    driverRepository,
    i18n,
    logger,
  )
})

describe('Create Event Service', () => {
  it('should be able to create a new event and update car status to IN_USE', async () => {
    const car = makeCar({ odometer: 1000 })
    const driver = makeDriver()
    const managerId = 'manager-1'

    await carRepository.create(car)
    await driverRepository.create(driver)

    const result = await sut.execute(
      makeEventInput({
        carId: car.id.toValue(),
        driverId: driver.id.toValue(),
        managerId,
        odometer: 1050,
      }),
    )

    expect(result.isRight()).toBeTruthy()

    if (result.isRight()) {
      const event = result.value.event
      const updatedCar = await carRepository.findById(car.id.toValue())

      expect(event.carId.toValue()).toBe(car.id.toValue())
      expect(event.driverId.toValue()).toBe(driver.id.toValue())
      expect(event.managerId.toValue()).toBe(managerId)
      expect(event.odometer).toBe(1050)
      expect(event.status).toBe('EXIT')
      expect(event.endAt).toBeUndefined()
      expect(updatedCar?.status).toBe('IN_USE')
    }
  })

  it('should not be able to create an event with non-existent car', async () => {
    vi.spyOn(i18n, 'translate').mockResolvedValue('Car not found.')

    const driver = makeDriver()
    await driverRepository.create(driver)

    const result = await sut.execute(
      makeEventInput({
        driverId: driver.id.toValue(),
      }),
    )

    expect(result.isLeft()).toBe(true)
    expect(result.value).toBeInstanceOf(CarNotFoundError)
    if (result.value instanceof CarNotFoundError) {
      expect(result.value.message).toBe('Car not found.')
    }
  })

  it('should not be able to create an event with non-existent driver', async () => {
    vi.spyOn(i18n, 'translate').mockResolvedValue('Driver not found.')

    const car = makeCar()
    await carRepository.create(car)

    const result = await sut.execute(
      makeEventInput({
        carId: car.id.toValue(),
      }),
    )

    expect(result.isLeft()).toBe(true)
    expect(result.value).toBeInstanceOf(DriverNotFoundError)
    if (result.value instanceof DriverNotFoundError) {
      expect(result.value.message).toBe('Driver not found.')
    }
  })

  it('should not be able to create an event with odometer less than car current odometer', async () => {
    vi.spyOn(i18n, 'translate').mockResolvedValue('Invalid odometer value.')

    const car = makeCar({ odometer: 2000 })
    const driver = makeDriver()

    await carRepository.create(car)
    await driverRepository.create(driver)

    const result = await sut.execute(
      makeEventInput({
        carId: car.id.toValue(),
        driverId: driver.id.toValue(),
        odometer: 1500,
      }),
    )

    expect(result.isLeft()).toBe(true)
    expect(result.value).toBeInstanceOf(InvalidOdometerError)
    if (result.value instanceof InvalidOdometerError) {
      expect(result.value.message).toBe('Invalid odometer value.')
    }
  })

  it('should not be able to create an event for a car that is already in use', async () => {
    vi.spyOn(i18n, 'translate').mockResolvedValue('Car is already in use.')

    const car = makeCar({ odometer: 1000 })
    const driver1 = makeDriver()
    const driver2 = makeDriver()
    const managerId = 'manager-1'

    await carRepository.create(car)
    await driverRepository.create(driver1)
    await driverRepository.create(driver2)

    const firstEvent = makeEvent({
      carId: car.id,
      driverId: driver1.id,
      managerId: new UniqueEntityID(managerId),
      odometer: 1000,
      status: 'EXIT',
    })

    await eventRepository.create(firstEvent)

    const result = await sut.execute(
      makeEventInput({
        carId: car.id.toValue(),
        driverId: driver2.id.toValue(),
        managerId,
        odometer: 1050,
      }),
    )

    expect(result.isLeft()).toBe(true)
    expect(result.value).toBeInstanceOf(CarInUseError)
    if (result.value instanceof CarInUseError) {
      expect(result.value.message).toBe('Car is already in use.')
    }
  })

  it('should not be able to create an event with an inactive car', async () => {
    vi.spyOn(i18n, 'translate').mockResolvedValue('Car is inactive.')

    const car = makeCar({ isActive: false })
    const driver = makeDriver()

    await carRepository.create(car)
    await driverRepository.create(driver)

    const result = await sut.execute(
      makeEventInput({
        carId: car.id.toValue(),
        driverId: driver.id.toValue(),
      }),
    )

    expect(result.isLeft()).toBe(true)
    expect(result.value).toBeInstanceOf(InactiveCarError)
    if (result.value instanceof InactiveCarError) {
      expect(result.value.message).toBe('Car is inactive.')
    }
  })

  it('should not be able to create an event with an inactive driver', async () => {
    vi.spyOn(i18n, 'translate').mockResolvedValue('Driver is inactive.')

    const car = makeCar()
    const driver = makeDriver({ isActive: false })

    await carRepository.create(car)
    await driverRepository.create(driver)

    const result = await sut.execute(
      makeEventInput({
        carId: car.id.toValue(),
        driverId: driver.id.toValue(),
      }),
    )

    expect(result.isLeft()).toBe(true)
    expect(result.value).toBeInstanceOf(InactiveDriverError)
    if (result.value instanceof InactiveDriverError) {
      expect(result.value.message).toBe('Driver is inactive.')
    }
  })
})
