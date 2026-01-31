/**
 * Files Module - File operations
 */
import { apiCall, InternalSession } from '../api';
import { FileInfo, DownloadLinks, ContentItem, SearchResults } from '../types';
import { formatBytes } from '../utils';

/**
 * Files module for file operations
 */
export class FilesModule {
  constructor(private getSession: () => InternalSession | null) {}

  /**
   * Get file information
   * 
   * @param quickKey - File quick key
   * @returns File info
   * @throws MediaFireError if not authenticated or API error
   * 
   * @example
   * ```typescript
   * const file = await client.files.getInfo('abc123quickkey');
   * console.log(`File: ${file.name} (${file.sizeFormatted})`);
   * ```
   */
  async getInfo(quickKey: string): Promise<FileInfo> {
    const session = this.getSession();
    if (!session) {
      throw new Error('Not authenticated. Please call login() first.');
    }

    interface FileInfoResponse {
      file_info?: {
        quickkey: string;
        filename: string;
        size?: string;
        created?: string;
        mimetype?: string;
        downloads?: string;
        privacy?: string;
        password_protected?: string;
      };
      file_infos?: Array<{
        quickkey: string;
        filename: string;
        size?: string;
        created?: string;
        mimetype?: string;
        downloads?: string;
        privacy?: string;
        password_protected?: string;
      }>;
    }

    const response = await apiCall<FileInfoResponse>('file/get_info', {
      quick_key: quickKey
    }, session);

    const info = response.file_info || response.file_infos?.[0];
    if (!info) {
      throw new Error(`File not found: ${quickKey}`);
    }

    const size = parseInt(info.size || '0', 10);

    return {
      quickKey: info.quickkey,
      name: info.filename,
      size,
      sizeFormatted: formatBytes(size),
      created: info.created,
      mimeType: info.mimetype,
      downloads: parseInt(info.downloads || '0', 10),
      privacy: info.privacy,
      passwordProtected: info.password_protected === 'yes'
    };
  }

  /**
   * Get download links for a file
   * 
   * @param quickKey - File quick key
   * @returns Download links
   * @throws MediaFireError if not authenticated or API error
   * 
   * @example
   * ```typescript
   * const links = await client.files.getLinks('abc123quickkey');
   * console.log(`Download: ${links.directDownload}`);
   * ```
   */
  async getLinks(quickKey: string): Promise<DownloadLinks> {
    const session = this.getSession();
    if (!session) {
      throw new Error('Not authenticated. Please call login() first.');
    }

    interface LinksResponse {
      links?: Array<{
        direct_download?: string;
        normal_download?: string;
      }>;
    }

    const response = await apiCall<LinksResponse>('file/get_links', {
      quick_key: quickKey,
      link_type: 'direct_download'
    }, session);

    const linkInfo = response.links?.[0] || {};

    return {
      directDownload: linkInfo.direct_download,
      normalDownload: linkInfo.normal_download,
      viewLink: `https://www.mediafire.com/file/${quickKey}`
    };
  }

  /**
   * Search for files
   * 
   * @param query - Search query
   * @returns Search results
   * @throws MediaFireError if not authenticated or API error
   * 
   * @example
   * ```typescript
   * const results = await client.files.search('document.pdf');
   * console.log(`Found ${results.total} files`);
   * results.items.forEach(item => console.log(item.name));
   * ```
   */
  async search(query: string): Promise<SearchResults> {
    const session = this.getSession();
    if (!session) {
      throw new Error('Not authenticated. Please call login() first.');
    }

    interface SearchResponse {
      results?: Array<{
        type: string;
        folderkey?: string;
        quickkey?: string;
        name?: string;
        filename?: string;
        size?: string;
        mimetype?: string;
        parent_folderkey?: string;
        parent_name?: string;
      }>;
    }

    const response = await apiCall<SearchResponse>('folder/search', {
      search_text: query,
      filter: 'everything'
    }, session);

    const results = response.results || [];
    
    const items: ContentItem[] = results.map(item => {
      if (item.type === 'folder') {
        return {
          id: item.folderkey || '',
          folderKey: item.folderkey || '',
          name: item.name || '',
          created: undefined,
          fileCount: 0,
          folderCount: 0,
          parentFolderKey: item.parent_folderkey,
          parentName: item.parent_name,
          isFolder: true as const
        };
      } else {
        const size = parseInt(item.size || '0', 10);
        return {
          id: item.quickkey || '',
          quickKey: item.quickkey || '',
          name: item.filename || item.name || '',
          size,
          sizeFormatted: formatBytes(size),
          mimeType: item.mimetype,
          parentFolderKey: item.parent_folderkey,
          parentName: item.parent_name,
          isFolder: false as const
        };
      }
    });

    return {
      query,
      items,
      total: items.length
    };
  }

  /**
   * Búsqueda inteligente que extrae palabras clave únicas del query
   * y filtra los resultados para coincidir con el nombre buscado.
   * 
   * La API de MediaFire no maneja bien queries con espacios o caracteres
   * especiales, por lo que este método:
   * 1. Extrae las palabras más únicas/distintivas del query
   * 2. Busca usando esas palabras simples
   * 3. Filtra los resultados para encontrar coincidencias reales
   * 
   * @param query - Nombre del archivo o carpeta a buscar
   * @param options - Opciones de búsqueda
   * @returns Resultados filtrados que coinciden con el query
   * 
   * @example
   * ```typescript
   * // Buscar con nombre completo
   * const results = await client.files.smartSearch(
   *   'La empresa de sillas (2025) Temporada 1 [1080p] {MAX} WEB-DL'
   * );
   * 
   * // Buscar solo carpetas
   * const folders = await client.files.smartSearch('Mi Serie', { 
   *   filter: 'folders' 
   * });
   * ```
   */
  async smartSearch(
    query: string, 
    options: {
      /** Filtrar por tipo: 'files', 'folders', o 'everything' */
      filter?: 'files' | 'folders' | 'everything';
      /** Si es true, requiere coincidencia exacta del nombre (sin case-sensitive) */
      exactMatch?: boolean;
    } = {}
  ): Promise<SearchResults> {
    const session = this.getSession();
    if (!session) {
      throw new Error('Not authenticated. Please call login() first.');
    }

    const { filter = 'everything', exactMatch = false } = options;

    // Extraer palabras clave del query
    const keywords = this.extractSearchKeywords(query);
    
    if (keywords.length === 0) {
      return { query, items: [], total: 0 };
    }

    // Usar la palabra más única/distintiva para la búsqueda API
    const searchTerm = keywords[0];

    interface SearchResponse {
      results?: Array<{
        type: string;
        folderkey?: string;
        quickkey?: string;
        name?: string;
        filename?: string;
        size?: string;
        mimetype?: string;
        parent_folderkey?: string;
        parent_name?: string;
      }>;
    }

    const response = await apiCall<SearchResponse>('folder/search', {
      search_text: searchTerm,
      filter: 'everything'
    }, session);

    const results = response.results || [];
    
    // Convertir y filtrar resultados
    let items: ContentItem[] = results.map(item => {
      if (item.type === 'folder') {
        return {
          id: item.folderkey || '',
          folderKey: item.folderkey || '',
          name: item.name || '',
          created: undefined,
          fileCount: 0,
          folderCount: 0,
          parentFolderKey: item.parent_folderkey,
          parentName: item.parent_name,
          isFolder: true as const
        };
      } else {
        const size = parseInt(item.size || '0', 10);
        return {
          id: item.quickkey || '',
          quickKey: item.quickkey || '',
          name: item.filename || item.name || '',
          size,
          sizeFormatted: formatBytes(size),
          mimeType: item.mimetype,
          parentFolderKey: item.parent_folderkey,
          parentName: item.parent_name,
          isFolder: false as const
        };
      }
    });

    // Filtrar por tipo si es necesario
    if (filter === 'files') {
      items = items.filter(item => !item.isFolder);
    } else if (filter === 'folders') {
      items = items.filter(item => item.isFolder);
    }

    // Filtrar por coincidencia con el query original
    if (exactMatch) {
      // Coincidencia exacta (case-insensitive)
      const queryLower = query.toLowerCase().trim();
      items = items.filter(item => 
        item.name.toLowerCase().trim() === queryLower
      );
    } else {
      // Verificar que todas las palabras clave estén en el nombre
      items = items.filter(item => 
        this.matchesAllKeywords(item.name, keywords)
      );
    }

    // Ordenar por relevancia (coincidencia más cercana primero)
    items = this.sortByRelevance(items, query);

    return {
      query,
      items,
      total: items.length
    };
  }

  /**
   * Extrae las palabras clave más distintivas de un query de búsqueda.
   * Filtra palabras comunes, años, resoluciones, etc.
   */
  private extractSearchKeywords(query: string): string[] {
    // Palabras comunes a ignorar (stop words y términos técnicos genéricos)
    const stopWords = new Set([
      // Resoluciones y calidad
      '1080p', '720p', '480p', '2160p', '4k', 'full', 'hd', 'uhd',
      'web', 'dl', 'webrip', 'bluray', 'brrip', 'bdrip', 'bdremux', 'remux',
      'hdr', 'hdr10', 'dv', 'dolby', 'vision', 'x264', 'x265', 'hevc', 'avc',
      // Plataformas
      'netflix', 'ntfx', 'amazon', 'amnz', 'hbo', 'max', 'disney', 'dsny',
      'apple', 'aptv', 'paramount', 'prmnt', 'peacock', 'hulu', 'vix',
      'mgm', 'mgm+', 'booh', 'booh!',
      // Idiomas
      'latino', 'español', 'castellano', 'ingles', 'inglés', 'subtitulado',
      'dual', 'multi', 'español', 'portugués', 'ruso',
      // Términos comunes
      'temporada', 'temp', 'season', 'capitulo', 'cap', 'episode', 'ep',
      'vip', 'hdlatino', 'us', 'com', 'www',
      // Artículos y preposiciones
      'el', 'la', 'los', 'las', 'un', 'una', 'de', 'del', 'en', 'con', 'por',
      'para', 'the', 'a', 'an', 'of', 'in', 'on', 'at', 'to', 'for', 'and', 'or'
    ]);

    // Limpiar el query: remover caracteres especiales excepto letras, números y espacios
    let cleaned = query
      .replace(/[\[\]{}()]/g, ' ')  // Remover brackets
      .replace(/[^\w\sáéíóúñü-]/gi, ' ')  // Mantener solo alfanuméricos y acentos
      .toLowerCase();

    // Dividir en palabras
    const words = cleaned.split(/\s+/).filter(word => word.length > 0);

    // Filtrar palabras
    const filtered = words.filter(word => {
      // Ignorar palabras muy cortas
      if (word.length < 3) return false;
      
      // Ignorar stop words
      if (stopWords.has(word)) return false;
      
      // Ignorar años (1900-2099)
      if (/^(19|20)\d{2}$/.test(word)) return false;
      
      // Ignorar números puros
      if (/^\d+$/.test(word)) return false;
      
      // Ignorar códigos de episodio (S01E01, etc.)
      if (/^s\d+e?\d*$/i.test(word)) return false;
      
      return true;
    });

    // Ordenar por unicidad (palabras menos comunes primero)
    // Priorizar palabras más largas y con caracteres especiales
    const scored = filtered.map(word => ({
      word,
      score: this.calculateWordScore(word, filtered)
    }));

    scored.sort((a, b) => b.score - a.score);

    // Retornar palabras únicas
    const unique = [...new Set(scored.map(s => s.word))];
    
    return unique.slice(0, 5);  // Máximo 5 palabras clave
  }

  /**
   * Calcula un score de unicidad para una palabra
   */
  private calculateWordScore(word: string, allWords: string[]): number {
    let score = 0;
    
    // Palabras más largas son más únicas
    score += word.length * 2;
    
    // Palabras con caracteres especiales/acentos son más distintivas
    if (/[áéíóúñü]/.test(word)) score += 5;
    
    // Palabras que aparecen una sola vez son más únicas
    const count = allWords.filter(w => w === word).length;
    if (count === 1) score += 10;
    
    // Penalizar palabras muy comunes en nombres de archivos
    const commonWords = ['serie', 'movie', 'film', 'show', 'video'];
    if (commonWords.includes(word)) score -= 5;
    
    return score;
  }

  /**
   * Verifica si un nombre contiene todas las palabras clave
   */
  private matchesAllKeywords(name: string, keywords: string[]): boolean {
    const nameLower = name.toLowerCase();
    
    // Verificar que al menos la primera palabra clave (la más única) esté presente
    if (keywords.length > 0 && !nameLower.includes(keywords[0])) {
      return false;
    }
    
    // Para una coincidencia más flexible, verificar que al menos 60% de las palabras estén
    const matchCount = keywords.filter(kw => nameLower.includes(kw)).length;
    const matchRatio = matchCount / keywords.length;
    
    return matchRatio >= 0.6;
  }

  /**
   * Ordena los resultados por relevancia respecto al query original
   */
  private sortByRelevance(items: ContentItem[], query: string): ContentItem[] {
    const queryLower = query.toLowerCase();
    
    return items.sort((a, b) => {
      const aName = a.name.toLowerCase();
      const bName = b.name.toLowerCase();
      
      // Coincidencia exacta primero
      if (aName === queryLower && bName !== queryLower) return -1;
      if (bName === queryLower && aName !== queryLower) return 1;
      
      // Luego, contiene el query completo
      const aContains = aName.includes(queryLower);
      const bContains = bName.includes(queryLower);
      if (aContains && !bContains) return -1;
      if (bContains && !aContains) return 1;
      
      // Luego, por similitud de longitud
      const aDiff = Math.abs(a.name.length - query.length);
      const bDiff = Math.abs(b.name.length - query.length);
      
      return aDiff - bDiff;
    });
  }

  /**
   * Set file privacy (public or private)
   * 
   * @param quickKey - File quick key
   * @param privacy - Privacy setting: 'public' or 'private'
   * @returns True if successful
   * @throws MediaFireError if not authenticated or API error
   * 
   * @example
   * ```typescript
   * // Make file public
   * await client.files.setPrivacy('abc123quickkey', 'public');
   * 
   * // Make file private
   * await client.files.setPrivacy('abc123quickkey', 'private');
   * ```
   */
  async setPrivacy(quickKey: string, privacy: 'public' | 'private'): Promise<boolean> {
    const session = this.getSession();
    if (!session) {
      throw new Error('Not authenticated. Please call login() first.');
    }

    interface UpdateResponse {
      result?: string;
    }

    await apiCall<UpdateResponse>('file/update', {
      quick_key: quickKey,
      privacy: privacy
    }, session);

    return true;
  }

  /**
   * Make a file public
   * 
   * @param quickKey - File quick key
   * @returns True if successful
   * 
   * @example
   * ```typescript
   * await client.files.makePublic('abc123quickkey');
   * ```
   */
  async makePublic(quickKey: string): Promise<boolean> {
    return this.setPrivacy(quickKey, 'public');
  }

  /**
   * Make a file private
   * 
   * @param quickKey - File quick key
   * @returns True if successful
   * 
   * @example
   * ```typescript
   * await client.files.makePrivate('abc123quickkey');
   * ```
   */
  async makePrivate(quickKey: string): Promise<boolean> {
    return this.setPrivacy(quickKey, 'private');
  }

  /**
   * Copy a file to another folder
   * 
   * @param quickKey - File quick key (or comma-separated list)
   * @param folderKey - Destination folder key (default: root)
   * @returns New quick keys of copied files
   * 
   * @example
   * ```typescript
   * const newKeys = await client.files.copy('abc123', 'destFolder');
   * ```
   */
  async copy(quickKey: string, folderKey?: string): Promise<string[]> {
    const session = this.getSession();
    if (!session) {
      throw new Error('Not authenticated. Please call login() first.');
    }

    interface CopyResponse {
      new_quickkeys?: string[];
    }

    const response = await apiCall<CopyResponse>('file/copy', {
      quick_key: quickKey,
      folder_key: folderKey || 'myfiles'
    }, session);

    return response.new_quickkeys || [];
  }

  /**
   * Delete a file (move to trash)
   * 
   * @param quickKey - File quick key (or comma-separated list)
   * @returns True if successful
   * 
   * @example
   * ```typescript
   * await client.files.delete('abc123');
   * ```
   */
  async delete(quickKey: string): Promise<boolean> {
    const session = this.getSession();
    if (!session) {
      throw new Error('Not authenticated. Please call login() first.');
    }

    await apiCall('file/delete', {
      quick_key: quickKey
    }, session);

    return true;
  }

  /**
   * Move a file to another folder
   * 
   * @param quickKey - File quick key (or comma-separated list, max 500)
   * @param folderKey - Destination folder key (default: root)
   * @returns True if successful
   * 
   * @example
   * ```typescript
   * await client.files.move('abc123', 'destFolder');
   * ```
   */
  async move(quickKey: string, folderKey?: string): Promise<boolean> {
    const session = this.getSession();
    if (!session) {
      throw new Error('Not authenticated. Please call login() first.');
    }

    await apiCall('file/move', {
      quick_key: quickKey,
      folder_key: folderKey || 'myfiles'
    }, session);

    return true;
  }

  /**
   * Rename a file
   * 
   * @param quickKey - File quick key
   * @param newName - New file name (with extension)
   * @returns True if successful
   * 
   * @example
   * ```typescript
   * await client.files.rename('abc123', 'newname.pdf');
   * ```
   */
  async rename(quickKey: string, newName: string): Promise<boolean> {
    const session = this.getSession();
    if (!session) {
      throw new Error('Not authenticated. Please call login() first.');
    }

    await apiCall('file/update', {
      quick_key: quickKey,
      filename: newName
    }, session);

    return true;
  }

  /**
   * Permanently delete a file (cannot be recovered)
   * 
   * @param quickKey - File quick key (or comma-separated list)
   * @returns True if successful
   * 
   * @example
   * ```typescript
   * await client.files.purge('abc123');
   * ```
   */
  async purge(quickKey: string): Promise<boolean> {
    const session = this.getSession();
    if (!session) {
      throw new Error('Not authenticated. Please call login() first.');
    }

    await apiCall('file/purge', {
      quick_key: quickKey
    }, session);

    return true;
  }

  /**
   * Restore a file from trash
   * 
   * @param quickKey - File quick key (or comma-separated list)
   * @returns True if successful
   * 
   * @example
   * ```typescript
   * await client.files.restore('abc123');
   * ```
   */
  async restore(quickKey: string): Promise<boolean> {
    const session = this.getSession();
    if (!session) {
      throw new Error('Not authenticated. Please call login() first.');
    }

    await apiCall('file/restore', {
      quick_key: quickKey
    }, session);

    return true;
  }

  /**
   * Get file version history
   * 
   * @param quickKey - File quick key
   * @returns Array of file versions
   * 
   * @example
   * ```typescript
   * const versions = await client.files.getVersions('abc123');
   * ```
   */
  async getVersions(quickKey: string): Promise<Array<{ revision: number; date: string }>> {
    const session = this.getSession();
    if (!session) {
      throw new Error('Not authenticated. Please call login() first.');
    }

    interface VersionsResponse {
      file_versions?: Array<{
        revision: string;
        date: string;
      }>;
    }

    const response = await apiCall<VersionsResponse>('file/get_versions', {
      quick_key: quickKey
    }, session);

    return (response.file_versions || []).map(v => ({
      revision: parseInt(v.revision, 10),
      date: v.date
    }));
  }

  /**
   * Get recently modified files
   * 
   * @returns Array of recently modified files
   * 
   * @example
   * ```typescript
   * const recent = await client.files.getRecentlyModified();
   * ```
   */
  async getRecentlyModified(): Promise<FileInfo[]> {
    const session = this.getSession();
    if (!session) {
      throw new Error('Not authenticated. Please call login() first.');
    }

    interface RecentResponse {
      quickkeys?: string[];
    }

    const response = await apiCall<RecentResponse>('file/recently_modified', {}, session);
    
    const files: FileInfo[] = [];
    const quickKeys = response.quickkeys || [];
    
    for (const qk of quickKeys.slice(0, 10)) {
      try {
        const info = await this.getInfo(qk);
        files.push(info);
      } catch {
        // Skip files that can't be retrieved
      }
    }
    
    return files;
  }
}

