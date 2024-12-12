import { ApiProperty } from '@nestjs/swagger';
import { FileResponse } from 'src/entity/file.upload.entity';

export class FileResponseDto implements FileResponse {
  @ApiProperty()
  uploadId: string;

  @ApiProperty()
  status: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  fileId: string;

  @ApiProperty()
  uploadTime: Date;
}

export class GetMyFilesResponseDto {
  @ApiProperty({ type: FileResponseDto, isArray: true })
  data: FileResponseDto[];
}
