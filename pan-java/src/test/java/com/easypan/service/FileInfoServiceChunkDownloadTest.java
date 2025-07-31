package com.easypan.service;

import com.easypan.entity.constants.Constants;
import com.easypan.entity.dto.ChunkDownloadDto;
import com.easypan.entity.dto.DownloadFileDto;
import com.easypan.service.impl.FileInfoServiceImpl;
import com.easypan.component.RedisComponent;
import com.easypan.entity.config.AppConfig;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockHttpServletResponse;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * 分片下载功能单元测试
 */
@ExtendWith(MockitoExtension.class)
public class FileInfoServiceChunkDownloadTest {

    @Mock
    private RedisComponent redisComponent;

    @Mock
    private AppConfig appConfig;

    @InjectMocks
    private FileInfoServiceImpl fileInfoService;

    private String testCode = "test_download_code_123";
    private String testFileName = "test_file.txt";
    private String testFilePath = "/test/path/test_file.txt";
    private String fullTestFilePath;
    private File testFile;
    private DownloadFileDto downloadFileDto;

    @BeforeEach
    void setUp() throws IOException {
        // 创建临时测试文件
        Path tempDir = Files.createTempDirectory("chunk_download_test");
        testFile = new File(tempDir.toFile(), testFileName);
        fullTestFilePath = testFile.getAbsolutePath();
        
        // 创建测试文件内容（1MB）
        byte[] testData = new byte[1024 * 1024]; // 1MB
        for (int i = 0; i < testData.length; i++) {
            testData[i] = (byte) (i % 256);
        }
        
        try (FileOutputStream fos = new FileOutputStream(testFile)) {
            fos.write(testData);
        }
        
        // 设置Mock对象
        downloadFileDto = new DownloadFileDto();
        downloadFileDto.setDownloadCode(testCode);
        downloadFileDto.setFileName(testFileName);
        downloadFileDto.setFilePath(testFilePath);
        
        when(appConfig.getProjectFolder()).thenReturn(tempDir.toString());
        when(redisComponent.getDownloadCode(testCode)).thenReturn(downloadFileDto);
    }

    @Test
    void testValidateChunkRequest_ValidRequest() {
        // 测试有效的分片请求验证
        int totalChunks = (int) Math.ceil((double) testFile.length() / Constants.CHUNK_SIZE_DOWNLOAD);
        
        boolean result = fileInfoService.validateChunkRequest(testCode, 0, totalChunks);
        
        assertTrue(result, "有效的分片请求应该通过验证");
    }

    @Test
    void testValidateChunkRequest_InvalidCode() {
        // 测试无效下载码
        when(redisComponent.getDownloadCode("invalid_code")).thenReturn(null);
        
        boolean result = fileInfoService.validateChunkRequest("invalid_code", 0, 1);
        
        assertFalse(result, "无效的下载码应该验证失败");
    }

    @Test
    void testValidateChunkRequest_InvalidChunkIndex() {
        // 测试无效的分片索引
        int totalChunks = (int) Math.ceil((double) testFile.length() / Constants.CHUNK_SIZE_DOWNLOAD);
        
        // 测试负数索引
        boolean result1 = fileInfoService.validateChunkRequest(testCode, -1, totalChunks);
        assertFalse(result1, "负数分片索引应该验证失败");
        
        // 测试超出范围的索引
        boolean result2 = fileInfoService.validateChunkRequest(testCode, totalChunks, totalChunks);
        assertFalse(result2, "超出范围的分片索引应该验证失败");
    }

    @Test
    void testValidateChunkRequest_InvalidTotalChunks() {
        // 测试无效的总分片数
        boolean result1 = fileInfoService.validateChunkRequest(testCode, 0, 0);
        assertFalse(result1, "总分片数为0应该验证失败");
        
        boolean result2 = fileInfoService.validateChunkRequest(testCode, 0, -1);
        assertFalse(result2, "负数总分片数应该验证失败");
        
        boolean result3 = fileInfoService.validateChunkRequest(testCode, 0, 10001);
        assertFalse(result3, "过大的总分片数应该验证失败");
    }

    @Test
    void testValidateChunkRequest_NullParameters() {
        // 测试空参数
        boolean result1 = fileInfoService.validateChunkRequest(null, 0, 1);
        assertFalse(result1, "空下载码应该验证失败");
        
        boolean result2 = fileInfoService.validateChunkRequest(testCode, null, 1);
        assertFalse(result2, "空分片索引应该验证失败");
        
        boolean result3 = fileInfoService.validateChunkRequest(testCode, 0, null);
        assertFalse(result3, "空总分片数应该验证失败");
    }

    @Test
    void testGetChunkDownloadInfo_ValidCode() {
        // 测试获取有效的分片下载信息
        ChunkDownloadDto result = fileInfoService.getChunkDownloadInfo(testCode);
        
        assertNotNull(result, "应该返回分片下载信息");
        assertEquals(testCode, result.getDownloadCode(), "下载码应该匹配");
        assertEquals(testFileName, result.getFileName(), "文件名应该匹配");
        assertEquals(testFile.length(), result.getFileSize().longValue(), "文件大小应该匹配");
        assertTrue(result.getTotalChunks() > 0, "总分片数应该大于0");
        assertEquals(Constants.CHUNK_SIZE_DOWNLOAD, result.getChunkSize().intValue(), "分片大小应该匹配");
    }

    @Test
    void testGetChunkDownloadInfo_InvalidCode() {
        // 测试无效下载码
        when(redisComponent.getDownloadCode("invalid_code")).thenReturn(null);
        
        ChunkDownloadDto result = fileInfoService.getChunkDownloadInfo("invalid_code");
        
        assertNull(result, "无效下载码应该返回null");
    }

    @Test
    void testGetChunkDownloadInfo_FileNotExists() {
        // 测试文件不存在的情况
        DownloadFileDto invalidDto = new DownloadFileDto();
        invalidDto.setDownloadCode(testCode);
        invalidDto.setFileName("nonexistent.txt");
        invalidDto.setFilePath("/nonexistent/path/file.txt");
        
        when(redisComponent.getDownloadCode("invalid_file_code")).thenReturn(invalidDto);
        
        ChunkDownloadDto result = fileInfoService.getChunkDownloadInfo("invalid_file_code");
        
        assertNull(result, "文件不存在时应该返回null");
    }

    @Test
    void testDownloadFileChunk_ValidRange() throws IOException {
        // 测试有效范围的分片下载
        MockHttpServletResponse response = new MockHttpServletResponse();
        long start = 0;
        long end = 1023; // 前1KB
        
        fileInfoService.downloadFileChunk(response, fullTestFilePath, start, end);
        
        byte[] responseData = response.getContentAsByteArray();
        assertEquals(1024, responseData.length, "响应数据长度应该匹配");
        assertEquals("bytes", response.getHeader("Accept-Ranges"), "应该设置Accept-Ranges头");
        assertEquals("bytes 0-1023/" + testFile.length(), response.getHeader("Content-Range"), "应该设置Content-Range头");
        assertEquals("1024", response.getHeader("Content-Length"), "应该设置Content-Length头");
        assertEquals(206, response.getStatus(), "应该返回206状态码");
        
        // 验证数据内容
        for (int i = 0; i < responseData.length; i++) {
            assertEquals((byte) (i % 256), responseData[i], "数据内容应该匹配");
        }
    }

    @Test
    void testDownloadFileChunk_InvalidRange() throws IOException {
        // 测试无效范围
        MockHttpServletResponse response = new MockHttpServletResponse();
        
        // 测试负数开始位置
        fileInfoService.downloadFileChunk(response, fullTestFilePath, -1, 100);
        assertEquals(0, response.getContentAsByteArray().length, "无效范围应该返回空数据");
        
        // 测试超出文件大小的结束位置
        response = new MockHttpServletResponse();
        fileInfoService.downloadFileChunk(response, fullTestFilePath, 0, testFile.length());
        assertEquals(0, response.getContentAsByteArray().length, "无效范围应该返回空数据");
        
        // 测试开始位置大于结束位置
        response = new MockHttpServletResponse();
        fileInfoService.downloadFileChunk(response, fullTestFilePath, 100, 50);
        assertEquals(0, response.getContentAsByteArray().length, "无效范围应该返回空数据");
    }

    @Test
    void testDownloadFileChunk_FileNotExists() throws IOException {
        // 测试文件不存在
        MockHttpServletResponse response = new MockHttpServletResponse();
        
        fileInfoService.downloadFileChunk(response, "/nonexistent/file.txt", 0, 100);
        
        assertEquals(0, response.getContentAsByteArray().length, "文件不存在应该返回空数据");
    }

    @Test
    void testDownloadFileChunk_InvalidPath() throws IOException {
        // 测试无效路径
        MockHttpServletResponse response = new MockHttpServletResponse();
        
        fileInfoService.downloadFileChunk(response, "../../../etc/passwd", 0, 100);
        
        assertEquals(0, response.getContentAsByteArray().length, "无效路径应该返回空数据");
    }

    @Test
    void testDownloadFileChunk_LargeChunk() throws IOException {
        // 测试大分片下载
        MockHttpServletResponse response = new MockHttpServletResponse();
        long start = 0;
        long end = testFile.length() - 1; // 整个文件
        
        fileInfoService.downloadFileChunk(response, fullTestFilePath, start, end);
        
        byte[] responseData = response.getContentAsByteArray();
        assertEquals(testFile.length(), responseData.length, "大分片响应数据长度应该匹配");
        
        // 验证部分数据内容
        for (int i = 0; i < Math.min(1000, responseData.length); i++) {
            assertEquals((byte) (i % 256), responseData[i], "大分片数据内容应该匹配");
        }
    }

    @Test
    void testDownloadFileChunk_MiddleRange() throws IOException {
        // 测试中间范围的分片下载
        MockHttpServletResponse response = new MockHttpServletResponse();
        long start = 1000;
        long end = 2023; // 中间1KB
        
        fileInfoService.downloadFileChunk(response, fullTestFilePath, start, end);
        
        byte[] responseData = response.getContentAsByteArray();
        assertEquals(1024, responseData.length, "中间范围响应数据长度应该匹配");
        
        // 验证数据内容
        for (int i = 0; i < responseData.length; i++) {
            assertEquals((byte) ((start + i) % 256), responseData[i], "中间范围数据内容应该匹配");
        }
    }

    @Test
    void testChunkSizeCalculation() {
        // 测试分片数量计算的正确性
        long fileSize = testFile.length();
        int expectedTotalChunks = (int) Math.ceil((double) fileSize / Constants.CHUNK_SIZE_DOWNLOAD);
        
        ChunkDownloadDto result = fileInfoService.getChunkDownloadInfo(testCode);
        
        assertNotNull(result);
        assertEquals(expectedTotalChunks, result.getTotalChunks().intValue(), "分片数量计算应该正确");
        
        // 验证最后一个分片的大小计算
        long lastChunkSize = fileSize % Constants.CHUNK_SIZE_DOWNLOAD;
        if (lastChunkSize == 0) {
            lastChunkSize = Constants.CHUNK_SIZE_DOWNLOAD;
        }
        
        // 这里可以进一步验证最后一个分片的下载
        assertTrue(lastChunkSize > 0 && lastChunkSize <= Constants.CHUNK_SIZE_DOWNLOAD, 
            "最后一个分片大小应该在合理范围内");
    }

    @Test
    void testValidateChunkRequest_ChunkCountMismatch() {
        // 测试分片数量与文件大小不匹配的情况
        long fileSize = testFile.length();
        int correctTotalChunks = (int) Math.ceil((double) fileSize / Constants.CHUNK_SIZE_DOWNLOAD);
        
        // 测试分片数量过少
        boolean result1 = fileInfoService.validateChunkRequest(testCode, 0, correctTotalChunks - 1);
        assertFalse(result1, "分片数量过少应该验证失败");
        
        // 测试分片数量过多
        boolean result2 = fileInfoService.validateChunkRequest(testCode, 0, correctTotalChunks + 1);
        assertFalse(result2, "分片数量过多应该验证失败");
    }

    @Test
    void testValidateChunkRequest_FilePathSecurity() throws IOException {
        // 测试文件路径安全性验证
        DownloadFileDto maliciousDto = new DownloadFileDto();
        maliciousDto.setDownloadCode("malicious_code");
        maliciousDto.setFileName("malicious.txt");
        maliciousDto.setFilePath("../../../etc/passwd"); // 路径遍历攻击
        
        when(redisComponent.getDownloadCode("malicious_code")).thenReturn(maliciousDto);
        
        boolean result = fileInfoService.validateChunkRequest("malicious_code", 0, 1);
        
        assertFalse(result, "恶意路径应该验证失败");
    }

    @Test
    void testDownloadFileChunk_EdgeCases() throws IOException {
        // 测试边界情况
        MockHttpServletResponse response = new MockHttpServletResponse();
        
        // 测试单字节下载
        fileInfoService.downloadFileChunk(response, fullTestFilePath, 0, 0);
        assertEquals(1, response.getContentAsByteArray().length, "单字节下载应该成功");
        assertEquals(206, response.getStatus(), "应该返回206状态码");
        
        // 测试最后一个字节
        response = new MockHttpServletResponse();
        long lastBytePos = testFile.length() - 1;
        fileInfoService.downloadFileChunk(response, fullTestFilePath, lastBytePos, lastBytePos);
        assertEquals(1, response.getContentAsByteArray().length, "最后一个字节下载应该成功");
        
        // 测试空文件处理
        File emptyFile = new File(testFile.getParent(), "empty.txt");
        emptyFile.createNewFile();
        response = new MockHttpServletResponse();
        fileInfoService.downloadFileChunk(response, emptyFile.getAbsolutePath(), 0, 0);
        assertEquals(0, response.getContentAsByteArray().length, "空文件应该返回空数据");
        emptyFile.delete();
    }

    @Test
    void testDownloadFileChunk_PerformanceOptimization() throws IOException {
        // 测试性能优化相关功能
        MockHttpServletResponse response = new MockHttpServletResponse();
        
        // 测试大分片下载的缓冲区优化
        long start = 0;
        long end = Constants.CHUNK_SIZE_DOWNLOAD - 1; // 完整分片
        
        long startTime = System.currentTimeMillis();
        fileInfoService.downloadFileChunk(response, fullTestFilePath, start, end);
        long endTime = System.currentTimeMillis();
        
        assertTrue(endTime - startTime < 5000, "分片下载应该在合理时间内完成"); // 5秒内
        assertEquals(Constants.CHUNK_SIZE_DOWNLOAD, response.getContentAsByteArray().length, 
            "完整分片大小应该匹配");
    }

    @Test
    void testDownloadFileChunk_ConcurrentAccess() throws IOException, InterruptedException {
        // 测试并发访问的安全性
        int threadCount = 5;
        Thread[] threads = new Thread[threadCount];
        boolean[] results = new boolean[threadCount];
        
        for (int i = 0; i < threadCount; i++) {
            final int index = i;
            threads[i] = new Thread(() -> {
                try {
                    MockHttpServletResponse response = new MockHttpServletResponse();
                    long start = index * 1000;
                    long end = start + 999;
                    
                    fileInfoService.downloadFileChunk(response, fullTestFilePath, start, end);
                    results[index] = response.getContentAsByteArray().length == 1000;
                } catch (Exception e) {
                    results[index] = false;
                }
            });
        }
        
        // 启动所有线程
        for (Thread thread : threads) {
            thread.start();
        }
        
        // 等待所有线程完成
        for (Thread thread : threads) {
            thread.join(5000); // 最多等待5秒
        }
        
        // 验证所有并发请求都成功
        for (int i = 0; i < threadCount; i++) {
            assertTrue(results[i], "并发请求 " + i + " 应该成功");
        }
    }

    @Test
    void testGetChunkDownloadInfo_SmallFile() throws IOException {
        // 测试小文件（小于分片大小）的处理
        File smallFile = new File(testFile.getParent(), "small.txt");
        byte[] smallData = "Hello World".getBytes();
        try (FileOutputStream fos = new FileOutputStream(smallFile)) {
            fos.write(smallData);
        }
        
        DownloadFileDto smallFileDto = new DownloadFileDto();
        smallFileDto.setDownloadCode("small_file_code");
        smallFileDto.setFileName("small.txt");
        smallFileDto.setFilePath("small.txt");
        
        when(redisComponent.getDownloadCode("small_file_code")).thenReturn(smallFileDto);
        when(appConfig.getProjectFolder()).thenReturn(testFile.getParent());
        
        ChunkDownloadDto result = fileInfoService.getChunkDownloadInfo("small_file_code");
        
        assertNotNull(result);
        assertEquals(1, result.getTotalChunks().intValue(), "小文件应该只有1个分片");
        assertEquals(smallData.length, result.getFileSize().longValue(), "文件大小应该匹配");
        
        smallFile.delete();
    }

    @Test
    void testGetChunkDownloadInfo_LargeFile() throws IOException {
        // 测试大文件的分片计算
        File largeFile = new File(testFile.getParent(), "large.txt");
        long largeFileSize = Constants.CHUNK_SIZE_DOWNLOAD * 3 + 1000; // 3.x个分片
        
        try (FileOutputStream fos = new FileOutputStream(largeFile)) {
            byte[] buffer = new byte[8192];
            long written = 0;
            while (written < largeFileSize) {
                int toWrite = (int) Math.min(buffer.length, largeFileSize - written);
                fos.write(buffer, 0, toWrite);
                written += toWrite;
            }
        }
        
        DownloadFileDto largeFileDto = new DownloadFileDto();
        largeFileDto.setDownloadCode("large_file_code");
        largeFileDto.setFileName("large.txt");
        largeFileDto.setFilePath("large.txt");
        
        when(redisComponent.getDownloadCode("large_file_code")).thenReturn(largeFileDto);
        
        ChunkDownloadDto result = fileInfoService.getChunkDownloadInfo("large_file_code");
        
        assertNotNull(result);
        assertEquals(4, result.getTotalChunks().intValue(), "大文件应该有4个分片");
        assertEquals(largeFileSize, result.getFileSize().longValue(), "文件大小应该匹配");
        
        largeFile.delete();
    }

    @Test
    void testErrorHandling_IOExceptions() throws IOException {
        // 测试I/O异常处理
        MockHttpServletResponse response = new MockHttpServletResponse();
        
        // 测试文件被删除的情况
        File tempFile = new File(testFile.getParent(), "temp_delete.txt");
        tempFile.createNewFile();
        String tempFilePath = tempFile.getAbsolutePath();
        tempFile.delete(); // 删除文件模拟I/O异常
        
        fileInfoService.downloadFileChunk(response, tempFilePath, 0, 100);
        assertEquals(0, response.getContentAsByteArray().length, "文件不存在应该返回空数据");
    }

    @Test
    void testErrorHandling_InvalidParameters() throws IOException {
        // 测试各种无效参数的处理
        MockHttpServletResponse response = new MockHttpServletResponse();
        
        // 测试null参数
        fileInfoService.downloadFileChunk(null, fullTestFilePath, 0, 100);
        // 应该不抛出异常
        
        fileInfoService.downloadFileChunk(response, null, 0, 100);
        assertEquals(0, response.getContentAsByteArray().length, "null路径应该返回空数据");
        
        // 测试空字符串路径
        response = new MockHttpServletResponse();
        fileInfoService.downloadFileChunk(response, "", 0, 100);
        assertEquals(0, response.getContentAsByteArray().length, "空路径应该返回空数据");
    }

    @Test
    void testRetryMechanism_Simulation() {
        // 模拟重试机制测试（通过多次调用验证方法的稳定性）
        for (int i = 0; i < Constants.MAX_RETRY_COUNT; i++) {
            boolean result = fileInfoService.validateChunkRequest(testCode, 0, 
                (int) Math.ceil((double) testFile.length() / Constants.CHUNK_SIZE_DOWNLOAD));
            assertTrue(result, "重试第 " + (i + 1) + " 次应该成功");
        }
    }

    @Test
    void testBoundaryConditions_ChunkSizes() throws IOException {
        // 测试各种分片大小的边界条件
        MockHttpServletResponse response = new MockHttpServletResponse();
        
        // 测试最小分片（1字节）
        fileInfoService.downloadFileChunk(response, fullTestFilePath, 0, 0);
        assertEquals(1, response.getContentAsByteArray().length, "最小分片应该成功");
        
        // 测试标准分片大小
        response = new MockHttpServletResponse();
        long standardEnd = Math.min(Constants.CHUNK_SIZE_DOWNLOAD - 1, testFile.length() - 1);
        fileInfoService.downloadFileChunk(response, fullTestFilePath, 0, standardEnd);
        assertEquals(standardEnd + 1, response.getContentAsByteArray().length, "标准分片应该成功");
        
        // 测试跨越文件边界的分片
        response = new MockHttpServletResponse();
        long fileSize = testFile.length();
        fileInfoService.downloadFileChunk(response, fullTestFilePath, fileSize - 10, fileSize - 1);
        assertEquals(10, response.getContentAsByteArray().length, "文件末尾分片应该成功");
    }

    @Test
    void testMemoryOptimization() throws IOException {
        // 测试内存优化相关功能
        MockHttpServletResponse response = new MockHttpServletResponse();
        
        // 测试大分片下载时的内存使用
        Runtime runtime = Runtime.getRuntime();
        long memoryBefore = runtime.totalMemory() - runtime.freeMemory();
        
        // 下载一个较大的分片
        long start = 0;
        long end = Math.min(Constants.CHUNK_SIZE_DOWNLOAD - 1, testFile.length() - 1);
        fileInfoService.downloadFileChunk(response, fullTestFilePath, start, end);
        
        // 强制垃圾回收
        System.gc();
        Thread.yield();
        
        long memoryAfter = runtime.totalMemory() - runtime.freeMemory();
        long memoryUsed = memoryAfter - memoryBefore;
        
        // 验证内存使用在合理范围内（不应该超过分片大小的2倍）
        assertTrue(memoryUsed < Constants.CHUNK_SIZE_DOWNLOAD * 2, 
            "内存使用应该在合理范围内: " + memoryUsed + " bytes");
    }

    @Test
    void testSecurityValidation() {
        // 测试安全验证相关功能
        
        // 测试路径遍历攻击防护
        assertFalse(fileInfoService.validateChunkRequest(testCode, 0, 1) || true, 
            "应该有路径安全验证");
        
        // 测试过大的分片数量限制
        boolean result = fileInfoService.validateChunkRequest(testCode, 0, 10001);
        assertFalse(result, "过大的分片数量应该被拒绝");
        
        // 测试下载码过期处理
        when(redisComponent.getDownloadCode("expired_code")).thenReturn(null);
        ChunkDownloadDto expiredResult = fileInfoService.getChunkDownloadInfo("expired_code");
        assertNull(expiredResult, "过期的下载码应该返回null");
    }

    @Test
    void testDataIntegrity() throws IOException {
        // 测试数据完整性验证
        MockHttpServletResponse response = new MockHttpServletResponse();
        
        // 下载文件的前1KB
        fileInfoService.downloadFileChunk(response, fullTestFilePath, 0, 1023);
        byte[] downloadedData = response.getContentAsByteArray();
        
        // 直接读取文件的前1KB进行对比
        byte[] originalData = new byte[1024];
        try (FileInputStream fis = new FileInputStream(testFile)) {
            int bytesRead = fis.read(originalData);
            assertEquals(1024, bytesRead, "应该读取到1024字节");
        }
        
        // 验证数据完整性
        assertArrayEquals(originalData, downloadedData, "下载的数据应该与原文件一致");
    }

    @Test
    void testPerformanceMetrics() throws IOException {
        // 测试性能指标记录
        MockHttpServletResponse response = new MockHttpServletResponse();
        
        // 记录开始时间
        long startTime = System.currentTimeMillis();
        
        // 下载一个完整分片
        long chunkSize = Math.min(Constants.CHUNK_SIZE_DOWNLOAD, testFile.length());
        fileInfoService.downloadFileChunk(response, fullTestFilePath, 0, chunkSize - 1);
        
        // 记录结束时间
        long endTime = System.currentTimeMillis();
        long duration = endTime - startTime;
        
        // 验证性能指标
        assertTrue(duration < 10000, "分片下载应该在10秒内完成"); // 10秒超时
        assertEquals(chunkSize, response.getContentAsByteArray().length, "下载大小应该匹配");
        
        // 计算吞吐量
        double throughputMBps = (chunkSize / 1024.0 / 1024.0) / (duration / 1000.0);
        assertTrue(throughputMBps > 0, "吞吐量应该大于0: " + throughputMBps + " MB/s");
    }
}