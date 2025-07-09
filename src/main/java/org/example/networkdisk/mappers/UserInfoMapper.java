package org.example.networkdisk.mappers;

import org.example.networkdisk.entity.po.UserInfo;

public interface UserInfoMapper<T,K> {
    int deleteByPrimaryKey(String userId);

    int insert(UserInfo row);

    int insertSelective(UserInfo row);

    UserInfo selectByPrimaryKey(String userId);

    int updateByPrimaryKeySelective(UserInfo row);

    int updateByPrimaryKey(UserInfo row);

    UserInfo selectByEmail(String email);

}