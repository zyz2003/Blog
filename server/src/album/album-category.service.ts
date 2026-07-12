import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { AlbumCategoryRepository, CreateCategoryParams, UpdateCategoryParams } from './album-category.repository';
import { ErrorCodes } from '../common/constants/error-codes';

@Injectable()
export class AlbumCategoryService {
  constructor(
    private readonly albumCategoryRepo: AlbumCategoryRepository,
  ) {}

  /**
   * CreateCategory — matches Go AlbumCategoryService.CreateCategory.
   * Checks name uniqueness, then creates.
   */
  async createCategory(req: CreateCategoryParams) {
    // Check name uniqueness
    const existing = await this.albumCategoryRepo.getByName(req.name);
    if (existing) {
      throw new ConflictException(ErrorCodes.ALBUM_CATEGORY_NAME_EXISTS);
    }

    const category = await this.albumCategoryRepo.create(req);
    return this.toResponseDTO(category);
  }

  /**
   * ListCategories — matches Go AlbumCategoryService.ListCategories.
   * Returns all categories ordered by displayOrder.
   */
  async listCategories() {
    const categories = await this.albumCategoryRepo.findAll();
    return categories.map((cat: any) => this.toResponseDTO(cat));
  }

  /**
   * GetCategory — matches Go AlbumCategoryService.GetCategory.
   */
  async getCategory(id: number) {
    const category = await this.albumCategoryRepo.getById(id);
    if (!category) {
      throw new NotFoundException(ErrorCodes.ALBUM_CATEGORY_NOT_FOUND);
    }
    return this.toResponseDTO(category);
  }

  /**
   * UpdateCategory — matches Go AlbumCategoryService.UpdateCategory.
   * Checks name uniqueness if name is being changed.
   */
  async updateCategory(id: number, req: UpdateCategoryParams) {
    const existing = await this.albumCategoryRepo.getById(id);
    if (!existing) {
      throw new NotFoundException(ErrorCodes.ALBUM_CATEGORY_NOT_FOUND);
    }

    // Check name uniqueness if name is being changed
    if (req.name && req.name !== existing.name) {
      const nameConflict = await this.albumCategoryRepo.getByName(req.name);
      if (nameConflict) {
        throw new ConflictException(ErrorCodes.ALBUM_CATEGORY_NAME_EXISTS);
      }
    }

    const category = await this.albumCategoryRepo.update(id, req);
    if (!category) {
      throw new NotFoundException(ErrorCodes.ALBUM_CATEGORY_NOT_FOUND);
    }
    return this.toResponseDTO(category);
  }

  /**
   * DeleteCategory — matches Go AlbumCategoryService.DeleteCategory.
   * Delegates to repo which checks for album references.
   * If category is in use, throws error.
   */
  async deleteCategory(id: number) {
    const category = await this.albumCategoryRepo.getById(id);
    if (!category) {
      throw new NotFoundException(ErrorCodes.ALBUM_CATEGORY_NOT_FOUND);
    }

    const deleted = await this.albumCategoryRepo.delete(id);
    if (!deleted) {
      throw new ConflictException(ErrorCodes.ALBUM_CATEGORY_IN_USE);
    }
    return null;
  }

  /**
   * toResponseDTO — convert DB row to AlbumCategoryResponseDto.
   * Per D-188: only id, name, description, displayOrder fields.
   */
  private toResponseDTO(category: any) {
    if (!category) return null;
    return {
      id: category.id,
      name: category.name,
      description: category.description ?? '',
      displayOrder: category.displayOrder ?? 0,
    };
  }
}
