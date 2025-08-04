package com.easypan.kafka.service;

import com.easypan.entity.config.KafkaTopicConfig;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

import javax.annotation.Resource;

@Component
public class SendMessageService {
    @Resource
    private KafkaTemplate<String, String> kafkaTemplate;


}
