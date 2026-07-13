import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { DocSeriesRepository } from './doc-series.repository';
import { decodePublicID } from '../common/utils/sqids.util';
import { toISODateString } from '../common/utils/time.util';
import { ErrorCodes } from '../common/constants/error-codes';
import { CreateDocSeriesRequestDto } from './dto/create-doc-series-request.dto';
import { UpdateDocSeriesRequestDto } from './dto/update-doc-series-request.dto';
import {
  DocSeriesResponseDto,
} from './dto/doc-series-response.dto';
import { DocSeriesListResponseDto } from './dto/doc-series-list-response.dto';
import { DocSeriesWithArticlesDto } from './dto/doc-series-with-articles.dto';

@Injectable()
export class DocSeriesService {
  constructor(
    private readonly docSeriesRepo: DocSeriesRepository,
  ) {}

  /**
   * Create a new doc series.
   * Matches Go Create (service.go lines 46-61):
   * 1. Check name uniqueness via existsByName
   * 2. If exists -> throw error with Chinese message
   * 3. Create via repository
   * 4. Return DocSeriesResponse
   */
  async create(dto: CreateDocSeriesRequestDto): Promise<DocSeriesResponseDto> {
    // Check name uniqueness
    const exists = await this.docSeriesRepo.existsByName(dto.name);
    if (exists) {
      throw new BadRequestException(
        `系列名称 '${dto.name}' 已存在`,
      );
    }

    const series = await this.docSeriesRepo.create({
      name: dto.name,
      description: dto.description,
      coverUrl: dto.cover_url,
      sort: dto.sort,
    });

    return this.toAPIResponse(series);
  }

  /**
   * List doc series with pagination.
   * Matches Go List (service.go lines 64-92):
   * 1. Query via repository with pagination
   * 2. Map each item to DocSeriesResponse
   * 3. Return DocSeriesListResponse { list, total, page, pageSize }
   */
  async list(opts: { page?: number; pageSize?: number }): Promise<DocSeriesListResponseDto> {
    const page = opts.page || 1;
    const pageSize = opts.pageSize || 20;

    const result = await this.docSeriesRepo.list({ page, pageSize });

    return {
      list: result.items.map((item: any) => this.toAPIResponse(item)),
      total: result.total,
      page,
      pageSize,
    };
  }

  /**
   * Get doc series by public ID.
   * Matches Go GetByID (service.go lines 95-101):
   * 1. Query via repository
   * 2. Return DocSeriesResponse
   */
  async getById(publicID: string): Promise<DocSeriesResponseDto> {
    const series = await this.docSeriesRepo.getById(publicID);
    if (!series) {
      throw new NotFoundException(ErrorCodes.DOCSERIES_NOT_FOUND);
    }
    return this.toAPIResponse(series);
  }

  /**
   * Get doc series by public ID with associated articles.
   * Matches Go GetByIDWithArticles (service.go lines 104-106):
   * 1. Query series + articles via repository
   * 2. Return DocSeriesWithArticles
   */
  async getByIdWithArticles(publicID: string): Promise<DocSeriesWithArticlesDto> {
    const result = await this.docSeriesRepo.getByIdWithArticles(publicID);
    if (!result) {
      throw new NotFoundException(ErrorCodes.DOCSERIES_NOT_FOUND);
    }

    return {
      ...this.toAPIResponse(result),
      articles: result.articles,
    };
  }

  /**
   * Update doc series by public ID.
   * Matches Go Update (service.go lines 109-131):
   * 1. If name provided, check uniqueness (excluding self)
   * 2. Get current series to compare name
   * 3. If name exists and is different from current -> throw error
   * 4. Update via repository
   * 5. Return DocSeriesResponse
   */
  async update(
    publicID: string,
    dto: UpdateDocSeriesRequestDto,
  ): Promise<DocSeriesResponseDto> {
    // If name is being updated, check uniqueness excluding self
    if (dto.name !== undefined) {
      // Decode publicID to get dbID for exclusion
      const { dbID } = decodePublicID(publicID);
      const exists = await this.docSeriesRepo.existsByName(dto.name, dbID);
      if (exists) {
        throw new BadRequestException(
          `系列名称 '${dto.name}' 已存在`,
        );
      }
    }

    const updated = await this.docSeriesRepo.update(publicID, {
      name: dto.name,
      description: dto.description,
      coverUrl: dto.cover_url,
      sort: dto.sort,
    });

    if (!updated) {
      throw new NotFoundException(ErrorCodes.DOCSERIES_NOT_FOUND);
    }

    return this.toAPIResponse(updated);
  }

  /**
   * Delete doc series by public ID.
   * Matches Go Delete (service.go lines 134-144):
   * 1. Get series by ID
   * 2. If docCount > 0 -> throw error with count
   * 3. Delete via repository
   */
  async delete(publicID: string): Promise<void> {
    const series = await this.docSeriesRepo.getById(publicID);
    if (!series) {
      throw new NotFoundException(ErrorCodes.DOCSERIES_NOT_FOUND);
    }

    if (series.docCount > 0) {
      throw new BadRequestException(
        `无法删除，该系列下还有 ${series.docCount} 篇文档`,
      );
    }

    await this.docSeriesRepo.delete(publicID);
  }

  /**
   * Map DocSeries domain model to DocSeriesResponse.
   * Matches Go toAPIResponse (service.go lines 29-43).
   * ID is already Sqids-encoded by repository.
   * JSON keys use snake_case matching Go JSON tags.
   */
  private toAPIResponse(ds: any): DocSeriesResponseDto {
    if (!ds) return null as any;

    return {
      id: ds.id,
      created_at: toISODateString(ds.createdAt),
      updated_at: toISODateString(ds.updatedAt),
      name: ds.name,
      description: ds.description ?? '',
      cover_url: ds.coverUrl ?? '',
      sort: ds.sort ?? 0,
      doc_count: ds.docCount ?? 0,
    };
  }
}
