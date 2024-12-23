import { SetMetadata } from '@nestjs/common';

export const OnPort = (port: number) => SetMetadata('port', port);
