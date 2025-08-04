package com.easypan.entity.config;

import com.easypan.component.KafkaComponent;
import org.apache.kafka.clients.admin.NewTopic;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.config.TopicBuilder;

@Configuration
public class KafkaTopicConfig {
    // 自动向集群发送 CreateTopicsRequest
    @Bean
    public NewTopic demoTopic() {
        return TopicBuilder.name("demo-topic")  // 主题名称
                .partitions(4)       // 分区数
                .replicas(3)          // 副本数
                .config("cleanup.policy", "delete")    // 删除策略
                .build();
    }

}
