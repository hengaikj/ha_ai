package com.hengaikj.ai;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import jakarta.servlet.*;
import jakarta.servlet.http.*;
import java.io.IOException;
import java.util.UUID;
@Component
public class RequestIdFilter extends OncePerRequestFilter {
 protected void doFilterInternal(HttpServletRequest request,HttpServletResponse response,FilterChain chain) throws ServletException,IOException {
  String id=UUID.randomUUID().toString(); request.setAttribute("requestId",id); response.setHeader("x-request-id",id); chain.doFilter(request,response);
 }
}
