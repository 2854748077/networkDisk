package com.easypan.controller;

import com.easypan.component.KafkaComponent;
import com.easypan.entity.config.KafkaTopicConfig;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.annotation.Resource;

/**
 * kafka生产者
 */
@RestController
@RequestMapping("/kafka")
public class KafkaController {
    @Autowired
    private KafkaTemplate<String, String> kafkaTemplate;

    @Autowired
    KafkaTopicConfig kafkaTopicConfig;

    @Resource
    private KafkaComponent kafkaComponent;

    @GetMapping("/sendKafka")
    public String sendKafka() {
        kafkaComponent.sendMessage(KafkaComponent.TOPIC_USER_LOGIN, "test-user-456");
        return "Kafka 消息已发送！";
    }
}