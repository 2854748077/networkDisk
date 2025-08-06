package com.easypan.entity.dto;

import lombok.Data;
import org.springframework.stereotype.Component;

@Component
@Data
public class sendEmailEvent {
    private String email;
    private Integer type;

    public sendEmailEvent(String email, Integer type) {
        this.email = email;
        this.type = type;
    }
    public sendEmailEvent() {
    }
}
