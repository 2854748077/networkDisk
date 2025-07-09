package org.example.networkdisk.mappers;

import org.example.networkdisk.entity.po.EmailCode;
import org.example.networkdisk.entity.po.EmailCodeKey;

public interface EmailCodeMapper<T,K> {
    int deleteByPrimaryKey(EmailCodeKey key);

    int insert(EmailCode row);

    int insertSelective(EmailCode row);

    EmailCode selectByPrimaryKey(EmailCodeKey key);

    int updateByPrimaryKeySelective(EmailCode row);

    int updateByPrimaryKey(EmailCode row);
}