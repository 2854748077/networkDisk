package org.example.networkdisk.entity.po;

import java.util.Date;

public class FileInfo extends FileInfoKey {
    private String fileMd5;

    private String filePid;

    private Long fileSize;

    private String fileName;

    private String fileCover;

    private String filePath;

    private Date createTime;

    private Date lastUpdateTime;

    private Boolean folderType;

    private Boolean fileCategory;

    private Boolean fileType;

    private Boolean status;

    private Date recoveryTime;

    private Boolean delFlag;
    private String fileId;

    private String userId;

    public String getFileId() {
        return fileId;
    }

    public void setFileId(String fileId) {
        this.fileId = fileId == null ? null : fileId.trim();
    }

    public String getUserId() {
        return userId;
    }

    public void setUserId(String userId) {
        this.userId = userId == null ? null : userId.trim();
    }

    public String getFileMd5() {
        return fileMd5;
    }

    public void setFileMd5(String fileMd5) {
        this.fileMd5 = fileMd5 == null ? null : fileMd5.trim();
    }

    public String getFilePid() {
        return filePid;
    }

    public void setFilePid(String filePid) {
        this.filePid = filePid == null ? null : filePid.trim();
    }

    public Long getFileSize() {
        return fileSize;
    }

    public void setFileSize(Long fileSize) {
        this.fileSize = fileSize;
    }

    public String getFileName() {
        return fileName;
    }

    public void setFileName(String fileName) {
        this.fileName = fileName == null ? null : fileName.trim();
    }

    public String getFileCover() {
        return fileCover;
    }

    public void setFileCover(String fileCover) {
        this.fileCover = fileCover == null ? null : fileCover.trim();
    }

    public String getFilePath() {
        return filePath;
    }

    public void setFilePath(String filePath) {
        this.filePath = filePath == null ? null : filePath.trim();
    }

    public Date getCreateTime() {
        return createTime;
    }

    public void setCreateTime(Date createTime) {
        this.createTime = createTime;
    }

    public Date getLastUpdateTime() {
        return lastUpdateTime;
    }

    public void setLastUpdateTime(Date lastUpdateTime) {
        this.lastUpdateTime = lastUpdateTime;
    }

    public Boolean getFolderType() {
        return folderType;
    }

    public void setFolderType(Boolean folderType) {
        this.folderType = folderType;
    }

    public Boolean getFileCategory() {
        return fileCategory;
    }

    public void setFileCategory(Boolean fileCategory) {
        this.fileCategory = fileCategory;
    }

    public Boolean getFileType() {
        return fileType;
    }

    public void setFileType(Boolean fileType) {
        this.fileType = fileType;
    }

    public Boolean getStatus() {
        return status;
    }

    public void setStatus(Boolean status) {
        this.status = status;
    }

    public Date getRecoveryTime() {
        return recoveryTime;
    }

    public void setRecoveryTime(Date recoveryTime) {
        this.recoveryTime = recoveryTime;
    }

    public Boolean getDelFlag() {
        return delFlag;
    }

    public void setDelFlag(Boolean delFlag) {
        this.delFlag = delFlag;
    }
}