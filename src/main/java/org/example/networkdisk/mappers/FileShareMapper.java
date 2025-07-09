package org.example.networkdisk.mappers;

import org.example.networkdisk.entity.po.FileShare;

public interface FileShareMapper {
    int deleteByPrimaryKey(String shareId);

    int insert(FileShare row);

    int insertSelective(FileShare row);

    FileShare selectByPrimaryKey(String shareId);

    int updateByPrimaryKeySelective(FileShare row);

    int updateByPrimaryKey(FileShare row);
}