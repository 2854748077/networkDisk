/**
 * FileAssembler 单元测试
 */

import FileAssembler from '../FileAssembler.js';

// Mock URL.createObjectURL and URL.revokeObjectURL
global.URL = {
    createObjectURL: jest.fn(() => 'mock-object-url'),
    revokeObjectURL: jest.fn(),
};

// Mock document
global.document = {
    createElement: jest.fn(() => ({
        href: '',
        download: '',
        style: { display: '' },
        click: jest.fn(),
    })),
    body: {
        appendChild: jest.fn(),
        removeChild: jest.fn(),
    },
};

// Mock window.crypto for hash calculation
global.window = {
    crypto: {
        subtle: {
            digest: jest.fn().mockResolvedValue(new ArrayBuffer(32)),
        },
    },
};

// Mock performance.memory
global.performance = {
    memory: {
        usedJSHeapSize: 1024 * 1024,
        totalJSHeapSize: 2 * 1024 * 1024,
        jsHeapSizeLimit: 4 * 1024 * 1024,
    },
};

describe('FileAssembler', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('assembleChunks', () => {
        test('应该正确组装分片为完整文件', async () => {
            const chunks = new Map();
            chunks.set(0, new Blob(['chunk1']));
            chunks.set(1, new Blob(['chunk2']));
            chunks.set(2, new Blob(['chunk3']));
            
            const fileName = 'test.txt';
            const totalChunks = 3;
            const expectedSize = 18; // 'chunk1' + 'chunk2' + 'chunk3'
            
            const result = await FileAssembler.assembleChunks(chunks, fileName, totalChunks, expectedSize);
            
            expect(result).toBeInstanceOf(Blob);
            expect(result.size).toBe(expectedSize);
        });

        test('应该在缺少分片时抛出错误', async () => {
            const chunks = new Map();
            chunks.set(0, new Blob(['chunk1']));
            // 缺少分片1
            chunks.set(2, new Blob(['chunk3']));
            
            const fileName = 'test.txt';
            const totalChunks = 3;
            
            await expect(FileAssembler.assembleChunks(chunks, fileName, totalChunks))
                .rejects.toThrow('Missing chunks: 1');
        });

        test('应该在参数无效时抛出错误', async () => {
            // 测试无效的chunks参数
            await expect(FileAssembler.assembleChunks(null, 'test.txt', 1))
                .rejects.toThrow('Invalid chunks parameter: expected Map');
            
            // 测试无效的fileName参数
            await expect(FileAssembler.assembleChunks(new Map(), '', 1))
                .rejects.toThrow('Invalid fileName parameter: expected non-empty string');
            
            // 测试无效的totalChunks参数
            await expect(FileAssembler.assembleChunks(new Map(), 'test.txt', 0))
                .rejects.toThrow('Invalid totalChunks parameter: expected positive number');
        });

        test('应该在分片数据无效时抛出错误', async () => {
            const chunks = new Map();
            chunks.set(0, null); // 无效的分片数据
            
            const fileName = 'test.txt';
            const totalChunks = 1;
            
            await expect(FileAssembler.assembleChunks(chunks, fileName, totalChunks))
                .rejects.toThrow('Invalid chunk 0: expected Blob');
        });

        test('应该在分片为空时抛出错误', async () => {
            const chunks = new Map();
            chunks.set(0, new Blob([])); // 空分片
            
            const fileName = 'test.txt';
            const totalChunks = 1;
            
            await expect(FileAssembler.assembleChunks(chunks, fileName, totalChunks))
                .rejects.toThrow('Empty chunk 0: chunk size is 0');
        });

        test('应该对大文件使用流式处理', async () => {
            const chunks = new Map();
            // 创建大于100MB的模拟分片
            const largeChunk = new Blob(['x'.repeat(50 * 1024 * 1024)]); // 50MB
            chunks.set(0, largeChunk);
            chunks.set(1, largeChunk);
            chunks.set(2, largeChunk); // 总共150MB
            
            const fileName = 'large_file.txt';
            const totalChunks = 3;
            const expectedSize = 150 * 1024 * 1024;
            
            const result = await FileAssembler.assembleChunks(chunks, fileName, totalChunks, expectedSize);
            
            expect(result).toBeInstanceOf(Blob);
            expect(result.size).toBe(expectedSize);
        });
    });

    describe('validateFileIntegrity', () => {
        test('应该验证文件大小', async () => {
            const fileBlob = new Blob(['test content']);
            const expectedSize = fileBlob.size;
            
            const result = await FileAssembler.validateFileIntegrity(fileBlob, expectedSize);
            
            expect(result).toBe(true);
        });

        test('应该在文件大小不匹配时返回false', async () => {
            const fileBlob = new Blob(['test content']);
            const wrongSize = fileBlob.size + 10;
            
            const result = await FileAssembler.validateFileIntegrity(fileBlob, wrongSize);
            
            expect(result).toBe(false);
        });

        test('应该验证文件哈希', async () => {
            const fileBlob = new Blob(['test content']);
            const expectedHash = 'mock-hash';
            
            // Mock hash calculation
            global.window.crypto.subtle.digest.mockResolvedValue(
                new Uint8Array([0x12, 0x34, 0x56, 0x78]).buffer
            );
            
            const result = await FileAssembler.validateFileIntegrity(fileBlob, fileBlob.size, expectedHash);
            
            // 由于哈希不匹配，应该返回false
            expect(result).toBe(false);
        });

        test('应该处理哈希计算错误', async () => {
            const fileBlob = new Blob(['test content']);
            
            // Mock hash calculation error
            global.window.crypto.subtle.digest.mockRejectedValue(new Error('Hash calculation failed'));
            
            const result = await FileAssembler.validateFileIntegrity(fileBlob, fileBlob.size, 'some-hash');
            
            expect(result).toBe(false);
        });
    });

    describe('triggerDownload', () => {
        test('应该触发浏览器下载', () => {
            const fileBlob = new Blob(['test content']);
            const fileName = 'test.txt';
            
            const mockLink = {
                href: '',
                download: '',
                style: { display: '' },
                click: jest.fn(),
            };
            
            global.document.createElement.mockReturnValue(mockLink);
            
            FileAssembler.triggerDownload(fileBlob, fileName);
            
            expect(global.document.createElement).toHaveBeenCalledWith('a');
            expect(global.URL.createObjectURL).toHaveBeenCalledWith(fileBlob);
            expect(mockLink.href).toBe('mock-object-url');
            expect(mockLink.download).toBe(fileName);
            expect(mockLink.style.display).toBe('none');
            expect(global.document.body.appendChild).toHaveBeenCalledWith(mockLink);
            expect(mockLink.click).toHaveBeenCalled();
        });

        test('应该在参数无效时抛出错误', () => {
            expect(() => FileAssembler.triggerDownload(null, 'test.txt'))
                .toThrow('Invalid fileBlob parameter: expected Blob');
            
            expect(() => FileAssembler.triggerDownload(new Blob(['test']), ''))
                .toThrow('Invalid fileName parameter: expected non-empty string');
        });

        test('应该清理资源', (done) => {
            const fileBlob = new Blob(['test content']);
            const fileName = 'test.txt';
            
            const mockLink = {
                href: '',
                download: '',
                style: { display: '' },
                click: jest.fn(),
            };
            
            global.document.createElement.mockReturnValue(mockLink);
            
            FileAssembler.triggerDownload(fileBlob, fileName);
            
            // 验证清理操作在延迟后执行
            setTimeout(() => {
                expect(global.document.body.removeChild).toHaveBeenCalledWith(mockLink);
                expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('mock-object-url');
                done();
            }, 150);
        });
    });

    describe('assembleAndDownload', () => {
        test('应该组装并下载文件', async () => {
            const chunks = new Map();
            chunks.set(0, new Blob(['chunk1']));
            chunks.set(1, new Blob(['chunk2']));
            
            const fileName = 'test.txt';
            const totalChunks = 2;
            const expectedSize = 12;
            
            const mockLink = {
                href: '',
                download: '',
                style: { display: '' },
                click: jest.fn(),
            };
            
            global.document.createElement.mockReturnValue(mockLink);
            
            const result = await FileAssembler.assembleAndDownload(chunks, fileName, totalChunks, expectedSize);
            
            expect(result).toBeInstanceOf(Blob);
            expect(result.size).toBe(expectedSize);
            expect(mockLink.click).toHaveBeenCalled();
        });

        test('应该在严格验证模式下验证文件完整性', async () => {
            const chunks = new Map();
            chunks.set(0, new Blob(['chunk1']));
            
            const fileName = 'test.txt';
            const totalChunks = 1;
            const wrongSize = 100; // 错误的文件大小
            
            await expect(FileAssembler.assembleAndDownload(
                chunks, 
                fileName, 
                totalChunks, 
                wrongSize, 
                { strictValidation: true }
            )).rejects.toThrow('File integrity validation failed');
        });
    });

    describe('_getMimeType', () => {
        test('应该返回正确的MIME类型', () => {
            expect(FileAssembler._getMimeType('test.jpg')).toBe('image/jpeg');
            expect(FileAssembler._getMimeType('test.png')).toBe('image/png');
            expect(FileAssembler._getMimeType('test.pdf')).toBe('application/pdf');
            expect(FileAssembler._getMimeType('test.txt')).toBe('text/plain');
            expect(FileAssembler._getMimeType('test.mp4')).toBe('video/mp4');
            expect(FileAssembler._getMimeType('test.mp3')).toBe('audio/mpeg');
            expect(FileAssembler._getMimeType('test.zip')).toBe('application/zip');
        });

        test('应该处理大写扩展名', () => {
            expect(FileAssembler._getMimeType('test.JPG')).toBe('image/jpeg');
            expect(FileAssembler._getMimeType('test.PNG')).toBe('image/png');
        });

        test('应该在未知扩展名时返回null', () => {
            expect(FileAssembler._getMimeType('test.unknown')).toBe(null);
            expect(FileAssembler._getMimeType('test')).toBe(null);
            expect(FileAssembler._getMimeType('')).toBe(null);
            expect(FileAssembler._getMimeType(null)).toBe(null);
        });
    });

    describe('_calculateFileHash', () => {
        test('应该计算文件哈希', async () => {
            const fileBlob = new Blob(['test content']);
            
            // Mock hash calculation
            const mockHashBuffer = new Uint8Array([0x12, 0x34, 0x56, 0x78]).buffer;
            global.window.crypto.subtle.digest.mockResolvedValue(mockHashBuffer);
            
            const result = await FileAssembler._calculateFileHash(fileBlob);
            
            expect(result).toBe('12345678');
            expect(global.window.crypto.subtle.digest).toHaveBeenCalledWith('SHA-256', expect.any(ArrayBuffer));
        });

        test('应该在Web Crypto API不支持时返回null', async () => {
            const originalCrypto = global.window.crypto;
            global.window.crypto = null;
            
            const fileBlob = new Blob(['test content']);
            const result = await FileAssembler._calculateFileHash(fileBlob);
            
            expect(result).toBe(null);
            
            // 恢复原始crypto对象
            global.window.crypto = originalCrypto;
        });

        test('应该处理哈希计算错误', async () => {
            const fileBlob = new Blob(['test content']);
            
            global.window.crypto.subtle.digest.mockRejectedValue(new Error('Hash failed'));
            
            const result = await FileAssembler._calculateFileHash(fileBlob);
            
            expect(result).toBe(null);
        });
    });

    describe('_validateFileFormat', () => {
        test('应该验证已知文件格式', async () => {
            // Mock JPEG文件头
            const jpegHeader = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0]);
            const jpegBlob = new Blob([jpegHeader]);
            
            const result = await FileAssembler._validateFileFormat(jpegBlob);
            
            expect(result).toBe(true);
        });

        test('应该在验证失败时返回true（不阻止下载）', async () => {
            const unknownBlob = new Blob(['unknown format']);
            
            const result = await FileAssembler._validateFileFormat(unknownBlob);
            
            expect(result).toBe(true);
        });
    });

    describe('cleanupChunks', () => {
        test('应该清理分片数据', () => {
            const chunks = new Map();
            chunks.set(0, new Blob(['chunk1']));
            chunks.set(1, new Blob(['chunk2']));
            
            FileAssembler.cleanupChunks(chunks);
            
            expect(chunks.size).toBe(0);
        });

        test('应该处理无效的chunks参数', () => {
            expect(() => FileAssembler.cleanupChunks(null)).not.toThrow();
            expect(() => FileAssembler.cleanupChunks(undefined)).not.toThrow();
            expect(() => FileAssembler.cleanupChunks('invalid')).not.toThrow();
        });
    });

    describe('getMemoryUsage', () => {
        test('应该返回内存使用信息', () => {
            const result = FileAssembler.getMemoryUsage();
            
            expect(result).toEqual({
                used: 1024 * 1024,
                total: 2 * 1024 * 1024,
                limit: 4 * 1024 * 1024,
            });
        });

        test('应该在performance.memory不可用时返回null', () => {
            const originalMemory = global.performance.memory;
            global.performance.memory = undefined;
            
            const result = FileAssembler.getMemoryUsage();
            
            expect(result).toBe(null);
            
            // 恢复原始memory对象
            global.performance.memory = originalMemory;
        });
    });

    describe('_matchesSignature', () => {
        test('应该正确匹配文件签名', () => {
            const bytes = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10]);
            const jpegSignature = [0xFF, 0xD8, 0xFF];
            
            const result = FileAssembler._matchesSignature(bytes, jpegSignature);
            
            expect(result).toBe(true);
        });

        test('应该在签名不匹配时返回false', () => {
            const bytes = new Uint8Array([0x89, 0x50, 0x4E, 0x47]);
            const jpegSignature = [0xFF, 0xD8, 0xFF];
            
            const result = FileAssembler._matchesSignature(bytes, jpegSignature);
            
            expect(result).toBe(false);
        });

        test('应该在字节数不足时返回false', () => {
            const bytes = new Uint8Array([0xFF, 0xD8]);
            const jpegSignature = [0xFF, 0xD8, 0xFF];
            
            const result = FileAssembler._matchesSignature(bytes, jpegSignature);
            
            expect(result).toBe(false);
        });
    });
});