package com.easypan.component;

import com.alibaba.fastjson.JSON;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.SendResult;
import org.springframework.stereotype.Component;
import org.springframework.util.concurrent.ListenableFuture;
import org.springframework.util.concurrent.ListenableFutureCallback;

import javax.annotation.Resource;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutionException;
import com.easypan.entity.constants.Constants;


/**
 * Kafka消息组件
 * 用于处理异步消息发送和接收
 */
@Component
public class KafkaComponent {

    private static final Logger logger = LoggerFactory.getLogger(KafkaComponent.class);

    @Resource
    private KafkaTemplate<String, String> kafkaTemplate;

    /**
     * 文件上传事件主题
     */
    public static final String TOPIC_FILE_UPLOAD = "file-upload";

    /**
     * 文件删除事件主题
     */
    public static final String TOPIC_FILE_DELETE = "file-delete";

    /**
     * 用户登录事件主题
     */
    public static final String TOPIC_USER_LOGIN = "user-login";

    /**
     * 文件分享事件主题
     */
    public static final String TOPIC_FILE_SHARE = "file-share";

    /**
     * 发送消息到Kafka
     *
     * @param topic 主题
     * @param message 消息内容
     */
    public void sendMessage(String topic, Object message) {
        String jsonMessage = JSON.toJSONString(message);
        logger.info("发送消息: {}", jsonMessage);

        ListenableFuture<SendResult<String, String>> future = kafkaTemplate.send(topic, jsonMessage);

        future.addCallback(new ListenableFutureCallback<SendResult<String, String>>() {

            @Override
            public void onSuccess(SendResult<String, String> result) {
                logger.info("成功发送消息到Kafka - Topic: {}, Partition: {}, Offset: {}",
                        result.getRecordMetadata().topic(),
                        result.getRecordMetadata().partition(),
                        result.getRecordMetadata().offset());
            }

            @Override
            public void onFailure(Throwable ex) {
                logger.error("发送消息到Kafka失败 - Topic: {}, Error: {}",
                        topic, ex.getMessage(), ex);
            }

        });

    }
    /**
    * 异步发送
    * @param  topic 主题
    * @param message 消息内容
    * @return CompletableFuture
    * */
    public CompletableFuture<SendResult<String, String>> sendMessageAsync(String topic, Object message) {

        String jsonMessage = JSON.toJSONString(message);
        logger.info("发送消息: {}", jsonMessage);
        return CompletableFuture.supplyAsync( ()->{
                    try {
                        return kafkaTemplate.send(topic, jsonMessage).get();
                    } catch (Exception e) {
                        logger.error("异步发送消息失败：topic:{},message:{}",topic,jsonMessage);
                        throw new RuntimeException(e);
                    }
                }
        );
    }

    /**
     * 监听文件上传事件
     * */
    @KafkaListener(topics = TOPIC_FILE_UPLOAD,groupId = Constants.KAFKA_GROUP_ID)
    public void listenFileUpload(String message) {

        logger.info("接收到文件上传事件：{}",message);


    }

    @KafkaListener(topics = TOPIC_FILE_DELETE,groupId = Constants.KAFKA_GROUP_ID)
    public void listenFileDelete(String message) {

        logger.info("接收到文件删除事件：{}",message);


    }
    @KafkaListener(topics = TOPIC_USER_LOGIN,groupId = Constants.KAFKA_GROUP_ID)
    public void listenUserLogin(String message) {

        logger.info("接收到用户登录事件：{}",message);


    }
    @KafkaListener(topics = TOPIC_FILE_SHARE,groupId = Constants.KAFKA_GROUP_ID)
    public void listenFileShare(String message) {

        logger.info("接收到文件分享事件：{}",message);


    }





}
