import { Car } from '../../enterprise/entities/car.entity'

export abstract class CarRepository {
  abstract findById(id: string): Promise<Car | null>
  abstract findByLicensePlate(licensePlate: string): Promise<Car[] | null>
  abstract create(car: Car): Promise<Car>
  abstract save(car: Car): Promise<Car>
  abstract delete(id: string): Promise<void>
}
