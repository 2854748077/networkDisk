package org.example.networkdisk.mappers;

import org.example.networkdisk.entity.po.FileInfo;
import org.example.networkdisk.entity.po.FileInfoKey;

public interface FileInfoMapper {
    int deleteByPrimaryKey(FileInfoKey key);

    int insert(FileInfo row);

    int insertSelective(FileInfo row);

    FileInfo selectByPrimaryKey(FileInfoKey key);

    int updateByPrimaryKeySelective(FileInfo row);

    int updateByPrimaryKey(FileInfo row);
}