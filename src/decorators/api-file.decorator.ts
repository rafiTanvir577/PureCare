import { applyDecorators, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { ApiBody, ApiConsumes } from '@nestjs/swagger';
import { multerConfig } from 'config/multer';
import { existsSync, mkdirSync } from 'fs';
import { diskStorage } from 'multer';
import { fileMimetypeFilter } from 'src/helper/fileValidator/fileMimetype.filter';

export const ApiFile = (fieldName = 'files', required = false, localOptions?: MulterOptions, maxCount = 5) =>
  applyDecorators(
    UseInterceptors(FilesInterceptor(fieldName, maxCount, localOptions)),
    ApiConsumes('multipart/form-data'),
    ApiBody({
      schema: {
        type: 'object',
        required: required ? [fieldName] : [],
        properties: {
          [fieldName]: {
            type: 'array',
            items: {
              type: 'string',
              format: 'binary',
            },
          },
        },
      },
    }),
  );

export const ApiPdfFile = (fileName = 'files', required = false, multerConfigOptions: MulterOptions) => ApiFile(fileName, required, multerConfigOptions);
