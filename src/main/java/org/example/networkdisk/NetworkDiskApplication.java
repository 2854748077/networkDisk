package org.example.networkdisk;

import org.apache.ibatis.annotations.Mapper;
import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.web.servlet.config.annotation.EnableWebMvc;

@MapperScan(basePackages = "org.example.networkdisk.mappers")
@SpringBootApplication
@EnableWebMvc
public class NetworkDiskApplication {

    public static void main(String[] args) {
        SpringApplication.run(NetworkDiskApplication.class, args);
    }

}
