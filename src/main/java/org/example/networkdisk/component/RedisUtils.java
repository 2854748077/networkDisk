package org.example.networkdisk.component;

import org.example.networkdisk.entity.dto.SysSettingsDto;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Component;

import javax.annotation.Resource;
import java.util.ArrayList;
import java.util.concurrent.TimeUnit;

@Component("RedisUtils")
public class RedisUtils {

    public static final Logger logger= LoggerFactory.getLogger(RedisUtils.class);

    @Resource
    RedisTemplate<String,Object> redisTemplate;

    /**
     * 获取缓存
     */
    public Object get(String key) {
        return redisTemplate.opsForValue().get(key);
    }
    /*
    * 放进缓存
    * */
    public SysSettingsDto set(String key, SysSettingsDto value) {
        redisTemplate.opsForValue().set(key, value);
        new ArrayList<>();
        return value;
    }

    /**
     * 删除缓存
     */
    public void delete(String key) {
        redisTemplate.delete(key);
    }

    /**
     * 设置过期时间
     */
    public void expire(String key, long timeout, TimeUnit unit) {
        redisTemplate.expire(key, timeout, unit);
    }

}
