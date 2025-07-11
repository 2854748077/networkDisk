package org.example.networkdisk.aspect;

import org.aspectj.lang.JoinPoint;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.annotation.Before;
import org.aspectj.lang.annotation.Pointcut;
import org.aspectj.lang.reflect.MethodSignature;
import org.example.networkdisk.annotation.GlobalInterceptor;
import org.example.networkdisk.exception.BusinessException;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import javax.servlet.http.HttpServletRequest;
import java.lang.reflect.Method;

@Aspect
@Component("globalOperationAspect")
public class GlobalOperationAspect {

    @Pointcut("@annotation(org.example.networkdisk.annotation.GlobalInterceptor)")
    private void requestIntercept() {

    }
    @Pointcut("@annotation(org.example.networkdisk.annotation.GlobalInterceptor)")
    private void verifyParamPointCut() {

    }


    @Before("requestIntercept()")
    public void interceptorDo(JoinPoint point) throws BusinessException, NoSuchMethodException {

    Object target = point.getTarget();  ////返回被代理的目标对象（即被拦截的方法所属的对象）
    Object[] params = point.getArgs();
    String MethodName = point.getSignature().getName();
    Class<?>[] parameterTypes=((MethodSignature)point.getSignature()).getMethod().getParameterTypes();

    Method method = target.getClass().getMethod(MethodName, parameterTypes);
    GlobalInterceptor interceptor = method.getAnnotation(GlobalInterceptor.class);

        if (null == interceptor) {   //保留判空逻辑仍然是一个防御性编程的好习惯：
            return;
        }
        /**
         * 校验登录
         */
        if (interceptor.checkLogin() || interceptor.checkAdmin()) {
            checkLogin(interceptor.checkAdmin());
        }
        /**
         * 校验参数
         */
        if (interceptor.checkParams()) {
            validateParams(method, params);
        }

    }

    private void checkLogin(boolean b) {
        HttpServletRequest request = ((ServletRequestAttributes) RequestContextHolder.getRequestAttributes()).getRequest();
   }

    private void validateParams(Method method, Object[] params){

    }
}
