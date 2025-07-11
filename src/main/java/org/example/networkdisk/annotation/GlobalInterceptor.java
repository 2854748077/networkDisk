package org.example.networkdisk.annotation;


import org.apache.ibatis.annotations.Mapper;
import org.springframework.web.bind.annotation.Mapping;

import java.lang.annotation.*;

@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
@Documented
@Mapping
public @interface GlobalInterceptor {

    /*参数校验*/
    boolean checkParams() default false;


    boolean checkLogin() default false;

    boolean checkAdmin() default false;
}
