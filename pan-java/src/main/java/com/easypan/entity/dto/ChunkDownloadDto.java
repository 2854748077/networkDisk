package com.easypan.entity.dto;

import lombok.Data;

/**
 * 分片下载DTO
 * 用于管理文件分片下载的相关信息
 */
@Data
public class ChunkDownloadDto {
    private String downloadCode;
    private String filePath;
    private String fileName;
    private Long fileSize;
    private Integer totalChunks;
    private Integer chunkSize;

    public ChunkDownloadDto() {
    }

    public ChunkDownloadDto(String downloadCode, String filePath, String fileName, Long fileSize, Integer totalChunks, Integer chunkSize) {
        this.downloadCode = downloadCode;
        this.filePath = filePath;
        this.fileName = fileName;
        this.fileSize = fileSize;
        this.totalChunks = totalChunks;
        this.chunkSize = chunkSize;
    }
}
