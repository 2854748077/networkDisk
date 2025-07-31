/**
 * ChunkDownloader 单元测试
 */

import ChunkDownloader, { DOWNLOAD_STATUS, CHUNK_STATUS } from '../ChunkDownloader.js';

// Mock Request module
jest.mock('../Request.js', () => {
    return jest.fn();
});

// Mock localStorage
const localStorageMock = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
};
global.localStorage = localStorageMock;

// Mock navigator
Object.defineProperty(global.navigator, 'onLine', {
    writable: true,
    value: true,
});

// Mock window events
global.addEventListener = jest.fn();
global.removeEventListener = jest.fn();

describe('ChunkDownloader', () => {
    let downloader;
    const mockDownloadCode = 'test_download_code_123';
    const mockFileName = 'test_file.txt';
    const mockFileSize = 1024 * 1024; // 1MB
    
    beforeEach(() => {
        jest.clearAllMocks();
        localStorageMock.getItem.mockReturnValue(null);
        
        downloader = new ChunkDownloader(mockDownloadCode, mockFileName, mockFileSize, {
            chunkSize: 1024 * 512, // 512KB
            concurrentLimit: 3,
            maxRetries: 3
        });
    });

    afterEach(() => {
        if (downloader) {
            downloader.cancel();
        }
    });

    describe('构造函数', () => {
        test('应该正确初始化基本属性', () => {
            expect(downloader.downloadCode).toBe(mockDownloadCode);
            expect(downloader.fileName).toBe(mockFileName);
            expect(downloader.fileSize).toBe(mockFileSize);
            expect(downloader.chunkSize).toBe(1024 * 512);
            expect(downloader.concurrentLimit).toBe(3);
            expect(downloader.maxRetries).toBe(3);
        });

        test('应该正确计算总分片数', () => {
            const expectedTotalChunks = Math.ceil(mockFileSize / (1024 * 512));
            expect(downloader.totalChunks).toBe(expectedTotalChunks);
        });

        test('应该初始化所有分片状态为PENDING', () => {
            for (let i = 0; i < downloader.totalChunks; i++) {
                expect(downloader.chunkStatus.get(i)).toBe(CHUNK_STATUS.PENDING);
                expect(downloader.retryCount.get(i)).toBe(0);
            }
        });

        test('应该设置默认状态为PENDING', () => {
            expect(downloader.status).toBe(DOWNLOAD_STATUS.PENDING);
            expect(downloader.downloadedSize).toBe(0);
            expect(downloader.downloadProgress).toBe(0);
        });
    });

    describe('状态管理', () => {
        test('getStatus应该返回正确的状态信息', () => {
            const status = downloader.getStatus();
            
            expect(status).toHaveProperty('status');
            expect(status).toHaveProperty('progress');
            expect(status).toHaveProperty('downloadedSize');
            expect(status).toHaveProperty('totalSize');
            expect(status).toHaveProperty('speed');
            expect(status).toHaveProperty('completedChunks');
            expect(status).toHaveProperty('totalChunks');
            expect(status).toHaveProperty('failedChunks');
            expect(status).toHaveProperty('activeDownloads');
            
            expect(status.status).toBe(DOWNLOAD_STATUS.PENDING);
            expect(status.totalSize).toBe(mockFileSize);
            expect(status.totalChunks).toBe(downloader.totalChunks);
        });

        test('pause应该设置暂停状态', () => {
            downloader.status = DOWNLOAD_STATUS.DOWNLOADING;
            downloader.pause();
            
            expect(downloader.isPaused).toBe(true);
            expect(downloader.status).toBe(DOWNLOAD_STATUS.PAUSED);
        });

        test('cancel应该设置取消状态', () => {
            downloader.cancel();
            
            expect(downloader.isCancelled).toBe(true);
            expect(downloader.status).toBe(DOWNLOAD_STATUS.CANCELLED);
        });
    });

    describe('分片验证', () => {
        test('_isNetworkError应该正确识别网络错误', () => {
            const networkErrors = [
                new Error('network error'),
                new Error('timeout occurred'),
                new Error('connection failed'),
                new Error('fetch aborted'),
                { status: 0 },
                { status: 408 },
                { status: 500 },
                { name: 'NetworkError' },
                { name: 'TimeoutError' },
                { code: 'NETWORK_ERROR' }
            ];

            networkErrors.forEach(error => {
                expect(downloader._isNetworkError(error)).toBe(true);
            });
        });

        test('_isNetworkError应该正确识别非网络错误', () => {
            const nonNetworkErrors = [
                new Error('validation failed'),
                new Error('file not found'),
                { status: 200 },
                { status: 404 },
                { name: 'ValidationError' },
                null,
                undefined
            ];

            nonNetworkErrors.forEach(error => {
                expect(downloader._isNetworkError(error)).toBe(false);
            });
        });
    });

    describe('进度更新', () => {
        test('_updateProgress应该正确计算进度', () => {
            // 模拟一些分片完成
            downloader.chunkStatus.set(0, CHUNK_STATUS.COMPLETED);
            downloader.chunkStatus.set(1, CHUNK_STATUS.COMPLETED);
            
            const mockProgressCallback = jest.fn();
            downloader.onProgress = mockProgressCallback;
            
            downloader._updateProgress();
            
            const expectedProgress = Math.floor((2 / downloader.totalChunks) * 100);
            expect(downloader.downloadProgress).toBe(expectedProgress);
            expect(mockProgressCallback).toHaveBeenCalledWith(
                expect.objectContaining({
                    progress: expectedProgress,
                    completedChunks: 2,
                    totalChunks: downloader.totalChunks
                })
            );
        });

        test('_updateProgress应该正确计算下载大小', () => {
            // 模拟第一个分片完成
            downloader.chunkStatus.set(0, CHUNK_STATUS.COMPLETED);
            
            downloader._updateProgress();
            
            expect(downloader.downloadedSize).toBe(downloader.chunkSize);
        });

        test('_updateProgress应该正确处理最后一个分片', () => {
            const lastChunkIndex = downloader.totalChunks - 1;
            downloader.chunkStatus.set(lastChunkIndex, CHUNK_STATUS.COMPLETED);
            
            downloader._updateProgress();
            
            const expectedLastChunkSize = mockFileSize - (lastChunkIndex * downloader.chunkSize);
            expect(downloader.downloadedSize).toBe(expectedLastChunkSize);
        });
    });

    describe('下载完成检查', () => {
        test('_isDownloadComplete应该在所有分片完成时返回true', () => {
            // 设置所有分片为完成状态
            for (let i = 0; i < downloader.totalChunks; i++) {
                downloader.chunkStatus.set(i, CHUNK_STATUS.COMPLETED);
            }
            
            expect(downloader._isDownloadComplete()).toBe(true);
        });

        test('_isDownloadComplete应该在有未完成分片时返回false', () => {
            // 设置部分分片为完成状态
            for (let i = 0; i < downloader.totalChunks - 1; i++) {
                downloader.chunkStatus.set(i, CHUNK_STATUS.COMPLETED);
            }
            // 最后一个分片保持PENDING状态
            
            expect(downloader._isDownloadComplete()).toBe(false);
        });
    });

    describe('localStorage状态管理', () => {
        test('_saveDownloadState应该保存下载状态到localStorage', () => {
            // 设置一些分片为完成状态
            downloader.chunkStatus.set(0, CHUNK_STATUS.COMPLETED);
            downloader.chunkStatus.set(1, CHUNK_STATUS.COMPLETED);
            
            downloader._saveDownloadState();
            
            expect(localStorageMock.setItem).toHaveBeenCalledWith(
                `chunk_download_${mockDownloadCode}`,
                expect.stringContaining(mockFileName)
            );
        });

        test('_loadDownloadState应该从localStorage恢复状态', () => {
            const savedState = {
                fileName: mockFileName,
                fileSize: mockFileSize,
                totalChunks: downloader.totalChunks,
                completedChunks: [0, 1],
                timestamp: Date.now()
            };
            
            localStorageMock.getItem.mockReturnValue(JSON.stringify(savedState));
            
            const newDownloader = new ChunkDownloader(mockDownloadCode, mockFileName, mockFileSize);
            
            expect(newDownloader.chunkStatus.get(0)).toBe(CHUNK_STATUS.COMPLETED);
            expect(newDownloader.chunkStatus.get(1)).toBe(CHUNK_STATUS.COMPLETED);
            expect(newDownloader.chunkStatus.get(2)).toBe(CHUNK_STATUS.PENDING);
        });

        test('_clearDownloadState应该清除localStorage中的状态', () => {
            downloader._clearDownloadState();
            
            expect(localStorageMock.removeItem).toHaveBeenCalledWith(
                `chunk_download_${mockDownloadCode}`
            );
        });
    });

    describe('文件组装', () => {
        test('_assembleFile应该正确组装分片', async () => {
            // 创建模拟的分片数据
            const chunk1 = new Blob(['chunk1']);
            const chunk2 = new Blob(['chunk2']);
            
            downloader.downloadedChunks.set(0, chunk1);
            downloader.downloadedChunks.set(1, chunk2);
            downloader.totalChunks = 2;
            
            const result = await downloader._assembleFile();
            
            expect(result).toBeInstanceOf(Blob);
            expect(result.size).toBe(chunk1.size + chunk2.size);
        });

        test('_assembleFile应该在缺少分片时抛出错误', async () => {
            downloader.totalChunks = 2;
            downloader.downloadedChunks.set(0, new Blob(['chunk1']));
            // 缺少第二个分片
            
            await expect(downloader._assembleFile()).rejects.toThrow('Missing chunk 1');
        });
    });

    describe('网络状态监控', () => {
        test('应该监听网络状态变化', () => {
            expect(global.addEventListener).toHaveBeenCalledWith('online', expect.any(Function));
            expect(global.addEventListener).toHaveBeenCalledWith('offline', expect.any(Function));
        });

        test('_checkNetworkStatus应该返回当前网络状态', async () => {
            // Mock fetch for network check
            global.fetch = jest.fn().mockResolvedValue({ ok: true });
            
            const isOnline = await downloader._checkNetworkStatus();
            
            expect(isOnline).toBe(true);
            expect(downloader.isOnline).toBe(true);
        });

        test('_waitForNetworkRecovery应该等待网络恢复', async () => {
            // Mock network recovery
            let networkCheckCount = 0;
            downloader._checkNetworkStatus = jest.fn().mockImplementation(() => {
                networkCheckCount++;
                return Promise.resolve(networkCheckCount >= 2); // 第二次检查时恢复
            });
            
            const recovered = await downloader._waitForNetworkRecovery(5000);
            
            expect(recovered).toBe(true);
            expect(downloader._checkNetworkStatus).toHaveBeenCalledTimes(2);
        });
    });

    describe('错误处理', () => {
        test('应该正确处理下载错误', () => {
            const mockError = new Error('Download failed');
            const mockErrorCallback = jest.fn();
            downloader.onError = mockErrorCallback;
            
            // 模拟错误情况
            downloader.status = DOWNLOAD_STATUS.FAILED;
            if (downloader.onError) {
                downloader.onError(mockError);
            }
            
            expect(mockErrorCallback).toHaveBeenCalledWith(mockError);
        });
    });

    describe('延迟函数', () => {
        test('_delay应该等待指定时间', async () => {
            const startTime = Date.now();
            await downloader._delay(100);
            const endTime = Date.now();
            
            expect(endTime - startTime).toBeGreaterThanOrEqual(90); // 允许一些误差
        });
    });
});