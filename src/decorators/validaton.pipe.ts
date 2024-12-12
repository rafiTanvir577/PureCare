/* eslint-disable @typescript-eslint/ban-types */
import { ValidationOptions, registerDecorator, ValidationArguments, validateSync, ValidatorConstraint, ValidatorConstraintInterface } from 'class-validator';
import { plainToClass } from 'class-transformer';

/**
 * @decorator
 * @description A custom decorator to validate a validation-schema within a validation schema upload N levels
 * @param schema The validation Class
 */
export function ValidateNested(schema: new () => any, validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'ValidateNested',
      target: object.constructor,
      propertyName: propertyName,
      constraints: [],
      options: validationOptions,
      validator: {
        validate(value: any, args: ValidationArguments) {
          args.value;
          if (Array.isArray(value)) {
            for (let i = 0; i < (<Array<any>>value).length; i++) {
              if (value && schema && value[i] && validateSync(plainToClass(schema, value[i])).length) {
                return false;
              }
            }
            return true;
          } else {
            if (value && schema && validateSync(plainToClass(schema, value))?.length) {
              return false;
            } else return true;
          }
        },
        defaultMessage(args) {
          if (Array.isArray(args.value)) {
            for (let i = 0; i < (<Array<any>>args.value).length; i++) {
              return (
                args.value &&
                args.value[i] &&
                validateSync(plainToClass(schema, args.value[i]))
                  .map((e) => e.constraints)
                  .reduce((acc, next) => acc.concat(Object.values(next)), [])
              ).toString();
            }
          } else {
            return (
              args.value &&
              validateSync(plainToClass(schema, args.value))
                .map((e) => e.constraints)
                .reduce((acc, next) => acc.concat(Object.values(next)), [])
            ).toString();
          }
        },
      },
    });
  };
}

@ValidatorConstraint({ name: 'customStringValidation', async: false })
export class CustomValidationConstraint implements ValidatorConstraintInterface {
  validate(value: any, args: ValidationArguments) {
    const disallowedCharacters: string[] = args.constraints[0]?.length ? args.constraints[0] : ['.', '$', '-', ' '];
    // Remove any whitespace characters from the value
    const sanitizedValue = value.replace(/\s/g, '');

    if (disallowedCharacters.includes(sanitizedValue[0])) {
      return false;
    }
    // Check for multiple consecutive occurrences of "--", "$$", ".."
    if (sanitizedValue.match(/(--|\$\$|\.\.)/)) {
      return false;
    }

    return true;
  }
}

export function CustomStringValidation(validationOptions?: ValidationOptions, allowedChars: string[] = []) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'customStringValidation',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [allowedChars],
      validator: CustomValidationConstraint,
    });
  };
}
