import {
  Injectable,
  OnModuleInit,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { StoragePolicyRepository } from './storage-policy.repository';
import { generatePublicID, decodePublicID, EntityType } from '../common/utils/sqids.util';
import { ErrorCodes } from '../common/constants/error-codes';

const ALLOWED_FLAGS = ['article_image', 'comment_image', 'user_avatar'];

const DEFAULT_POLICIES = [
  {
    name: '内置-文章图片',
    type: 'local',
    flag: 'article_image',
    basePath: 'data/uploads',
    isPrivate: false,
    maxSize: 0,
  },
  {
    name: '内置-评论图片',
    type: 'local',
    flag: 'comment_image',
    basePath: 'data/uploads',
    isPrivate: false,
    maxSize: 0,
  },
  {
    name: '内置-用户头像',
    type: 'local',
    flag: 'user_avatar',
    basePath: 'data/uploads',
    isPrivate: false,
    maxSize: 0,
  },
];

@Injectable()
export class StoragePolicyService implements OnModuleInit {
  private readonly logger = new Logger(StoragePolicyService.name);

  constructor(private readonly repository: StoragePolicyRepository) {}

  async onModuleInit() {
    await this.initializeDefaultPolicies();
  }

  async create(data: any) {
    // Validate type is 'local' per D-99
    if (data.type && data.type !== 'local') {
      throw new BadRequestException(ErrorCodes.INVALID_POLICY_TYPE);
    }

    // Validate name uniqueness among non-deleted policies
    if (data.name) {
      const existing = await this.repository.findByName(data.name);
      if (existing) {
        throw new ConflictException(ErrorCodes.POLICY_NAME_CONFLICT);
      }
    }

    // Validate flag uniqueness per D-101
    if (data.flag) {
      if (!ALLOWED_FLAGS.includes(data.flag)) {
        throw new BadRequestException(ErrorCodes.INVALID_POLICY_TYPE);
      }
      const existing = await this.repository.findByFlag(data.flag);
      if (existing) {
        throw new ConflictException(ErrorCodes.STORAGE_POLICY_FLAG_CONFLICT);
      }
    }

    const policy = await this.repository.create({
      name: data.name,
      type: data.type || 'local',
      flag: data.flag || null,
      server: data.server || null,
      bucketName: data.bucketName || null,
      isPrivate: data.isPrivate ?? false,
      accessKey: data.accessKey || null,
      secretKey: data.secretKey || null,
      maxSize: data.maxSize ?? 0,
      basePath: data.basePath || null,
      virtualPath: data.virtualPath || null,
      settings: data.settings || null,
      nodeId: data.nodeId || null,
    });

    return this.toApiResponse(policy);
  }

  async getById(publicID: string) {
    const { dbID, entityType } = decodePublicID(publicID);
    if (entityType !== EntityType.StoragePolicy) {
      throw new NotFoundException(ErrorCodes.POLICY_NOT_FOUND);
    }

    const policy = await this.repository.findById(dbID);
    if (!policy) {
      throw new NotFoundException(ErrorCodes.POLICY_NOT_FOUND);
    }

    return this.toApiResponse(policy);
  }

  async list(options: { page: number; pageSize: number }) {
    const { list, total } = await this.repository.list(options);
    return {
      list: list.map((p: any) => this.toApiResponse(p)),
      total,
    };
  }

  async update(publicID: string, data: any) {
    const { dbID, entityType } = decodePublicID(publicID);
    if (entityType !== EntityType.StoragePolicy) {
      throw new NotFoundException(ErrorCodes.POLICY_NOT_FOUND);
    }

    const existing = await this.repository.findById(dbID);
    if (!existing) {
      throw new NotFoundException(ErrorCodes.POLICY_NOT_FOUND);
    }

    // Validate type is 'local' per D-99
    if (data.type && data.type !== 'local') {
      throw new BadRequestException(ErrorCodes.INVALID_POLICY_TYPE);
    }

    // Check name uniqueness if changed
    if (data.name && data.name !== existing.name) {
      const byName = await this.repository.findByName(data.name);
      if (byName) {
        throw new ConflictException(ErrorCodes.POLICY_NAME_CONFLICT);
      }
    }

    // Check flag uniqueness if changed per D-101
    if (data.flag && data.flag !== existing.flag) {
      if (!ALLOWED_FLAGS.includes(data.flag)) {
        throw new BadRequestException(ErrorCodes.INVALID_POLICY_TYPE);
      }
      const byFlag = await this.repository.findByFlag(data.flag);
      if (byFlag) {
        throw new ConflictException(ErrorCodes.STORAGE_POLICY_FLAG_CONFLICT);
      }
    }

    // If virtualPath is empty string, keep existing value (Go behavior per RESEARCH Section 4)
    if (data.virtualPath === '') {
      data.virtualPath = existing.virtualPath;
    }

    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.flag !== undefined) updateData.flag = data.flag;
    if (data.server !== undefined) updateData.server = data.server;
    if (data.bucketName !== undefined) updateData.bucketName = data.bucketName;
    if (data.isPrivate !== undefined) updateData.isPrivate = data.isPrivate;
    if (data.accessKey !== undefined) updateData.accessKey = data.accessKey;
    if (data.secretKey !== undefined) updateData.secretKey = data.secretKey;
    if (data.maxSize !== undefined) updateData.maxSize = data.maxSize;
    if (data.basePath !== undefined) updateData.basePath = data.basePath;
    if (data.virtualPath !== undefined) updateData.virtualPath = data.virtualPath;
    if (data.settings !== undefined) updateData.settings = data.settings;
    if (data.nodeId !== undefined) updateData.nodeId = data.nodeId;

    const policy = await this.repository.update(dbID, updateData);
    return this.toApiResponse(policy);
  }

  async delete(publicID: string) {
    const { dbID, entityType } = decodePublicID(publicID);
    if (entityType !== EntityType.StoragePolicy) {
      throw new NotFoundException(ErrorCodes.POLICY_NOT_FOUND);
    }

    const existing = await this.repository.findById(dbID);
    if (!existing) {
      throw new NotFoundException(ErrorCodes.POLICY_NOT_FOUND);
    }

    // Check if policy has referencing files per RESEARCH Section 4
    const hasFiles = await this.repository.hasReferencingFiles(dbID);
    if (hasFiles) {
      throw new BadRequestException(ErrorCodes.POLICY_USED_BY_FILES);
    }

    await this.repository.softDelete(dbID);
  }

  async initializeDefaultPolicies() {
    for (const def of DEFAULT_POLICIES) {
      try {
        const existing = await this.repository.findByFlag(def.flag);
        if (!existing) {
          await this.repository.create(def);
          this.logger.log(`Created default policy: ${def.name}`);
        }
      } catch (error) {
        this.logger.error(
          `Failed to create default policy ${def.name}: ${error.message}`,
        );
      }
    }
  }

  /**
   * Find a policy by its flag. Used by other modules (e.g., ArticleController for article_image).
   */
  async findByFlag(flag: string) {
    return this.repository.findByFlag(flag);
  }

  /**
   * Convert DB row to frontend-compatible snake_case response format.
   * Masks non-empty access_key/secret_key as '********' per RESEARCH Section 4.
   */
  toApiResponse(policy: any) {
    return {
      id: generatePublicID(policy.id, EntityType.StoragePolicy),
      created_at: policy.createdAt,
      updated_at: policy.updatedAt,
      name: policy.name,
      type: policy.type,
      flag: policy.flag,
      server: policy.server,
      bucket_name: policy.bucketName,
      is_private: policy.isPrivate,
      access_key: policy.accessKey ? '********' : '',
      secret_key: policy.secretKey ? '********' : '',
      max_size: policy.maxSize,
      base_path: policy.basePath,
      virtual_path: policy.virtualPath,
      settings: policy.settings,
      node_id: policy.nodeId,
    };
  }
}
