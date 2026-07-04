import { Controller, Get, Header, Res } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import type { Response } from 'express';

@Public()
@Controller('version')
export class VersionController {
  @Get()
  @Header('Cache-Control', 'no-cache, no-store, must-revalidate, private, max-age=0')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  getVersion() {
    return {
      data: {
        version: this.getVersionValue(),
        commit: this.getCommitValue(),
        date: this.getDateValue(),
        node_version: process.version,
      },
      message: '获取版本信息成功',
    };
  }

  @Get('string')
  getVersionString(@Res() res: Response) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, private, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    const version = this.getVersionValue();
    const commit = this.getCommitValue();
    const date = this.getDateValue();

    let versionString = version;
    if (commit !== 'unknown') {
      versionString += `, commit ${commit}`;
    }
    if (date !== 'unknown') {
      versionString += `, built at ${date}`;
    }

    res.json({ version: versionString });
  }

  private getVersionValue(): string {
    return process.env.VERSION || 'dev';
  }

  private getCommitValue(): string {
    return process.env.COMMIT || 'unknown';
  }

  private getDateValue(): string {
    return process.env.BUILD_DATE || 'unknown';
  }
}
