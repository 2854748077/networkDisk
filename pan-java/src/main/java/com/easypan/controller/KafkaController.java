package com.easypan.controller;

import com.easypan.component.KafkaComponent;
import com.easypan.entity.vo.ResponseVO;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.web.bind.annotation.*;

import javax.annotation.Resource;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Kafka 消息测试控制器
 * 提供 Kafka 消息发送和状态检查功能
 */
@RestController
@RequestMapping("/kafka")
@ConditionalOnProperty(name = "kafka.enabled", havingValue = "true")
public class KafkaController extends ABaseController {

    private static final Logger logger = LoggerFactory.getLogger(KafkaController.class);

    @Resource
    private KafkaComponent kafkaComponent;


    /**
     * 发送测试消息到指定 Topic
     */
    @RequestMapping("/send")
    public void sendMessage() {
        logger.info("发送消息");
     kafkaComponent.sendMessage(KafkaComponent.TOPIC_FILE_UPLOAD, "test");
    }

}