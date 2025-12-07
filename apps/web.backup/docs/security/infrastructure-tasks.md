# Infrastructure Security Tasks

## Overview

This document outlines the infrastructure tasks required to complete the React2Shell mitigation (SEC-R2S-010 and SEC-R2S-011). These tasks require coordination with DevOps/Infrastructure teams.

## SEC-R2S-010: WAF/CDN Rules for React2Shell

### Objective

Implement Web Application Firewall (WAF) or CDN rules to monitor and block suspicious Flight-related paths and React2Shell exploit patterns.

### Implementation Steps

1. **Identify WAF/CDN Provider**
   - Determine current CDN/WAF solution (Cloudflare, AWS WAF, CloudFront, etc.)
   - Review current WAF rules and configuration

2. **Create Monitoring Rules (Phase 1: Logging)**

   **Rule 1: Monitor React Flight Paths**
   - Path patterns to monitor:
     - `/__nextjs/*`
     - `/_next/*`
     - `*?__flight=*`
     - `*?__rsc=*`
   - Action: Log and alert
   - Log: Request headers, query parameters, IP address, user agent

   **Rule 2: Monitor Suspicious Headers**
   - Monitor requests with:
     - Unusual `RSC` headers
     - Suspicious `Next-Router` headers
     - Abnormal `Accept` headers containing Flight-related content types
   - Action: Log and alert

   **Rule 3: Monitor Known Payload Patterns**
   - Patterns to detect:
     - Base64-encoded payloads in query parameters
     - JavaScript code in query parameters
     - Suspicious serialized objects
   - Action: Log and alert

3. **Create Blocking Rules (Phase 2: After Validation)**

   After 1-2 weeks of monitoring:
   - Convert high-confidence signatures to blocking rules
   - Start with strict blocking on auth/credentialing routes
   - Gradually expand to other routes

4. **Recommended WAF Rules**

   **Cloudflare Example:**
   ```javascript
   // Rule: Block React2Shell patterns
   (http.request.uri.query contains "__flight" or
    http.request.uri.query contains "__rsc" or
    http.request.uri.path contains "/__nextjs/")
   and
   (http.request.body contains "eval(" or
    http.request.body contains "Function(" or
    http.request.body contains "require(")
   ```

   **AWS WAF Example:**
   - Create custom rule matching:
     - URI path contains `/__nextjs`
     - Query string contains `__flight` or `__rsc`
     - Body contains suspicious patterns

5. **Testing**
   - Test rules in logging mode first
   - Validate false positive rate
   - Test legitimate requests are not blocked
   - Gradually enable blocking

### Success Criteria

- ✅ WAF rules created and active
- ✅ Monitoring dashboard shows React2Shell-related activity
- ✅ Alerts configured for suspicious patterns
- ✅ Blocking rules validated and enabled (after monitoring period)

---

## SEC-R2S-011: Centralize Security Logging

### Objective

Ensure that requests blocked by WAF/CDN or flagged as suspicious reach a central log sink with proper dashboards and alerts.

### Implementation Steps

1. **Choose Logging Solution**
   - Options:
     - AWS CloudWatch (if using AWS)
     - Google Cloud Logging (if using GCP)
     - ELK Stack (Elasticsearch, Logstash, Kibana)
     - Datadog, Splunk, or similar

2. **Configure Log Aggregation**

   **Sources to Aggregate:**
   - WAF/CDN logs (blocked requests)
   - Application logs (rate limit violations, CSRF failures)
   - API gateway logs
   - Load balancer logs

3. **Create Log Structure**

   **Recommended Log Fields:**
   ```json
   {
     "timestamp": "2025-01-XXT...",
     "event_type": "waf_block|rate_limit|csrf_failure",
     "ip_address": "192.168.1.1",
     "user_agent": "...",
     "request_path": "/api/auth/login",
     "request_method": "POST",
     "block_reason": "react2shell_pattern_detected",
     "severity": "high",
     "metadata": {
       "query_params": "...",
       "headers": "...",
       "body_preview": "..."
     }
   }
   ```

4. **Create Dashboards**

   **Dashboard 1: React2Shell Activity**
   - Metrics:
     - Total blocked requests (last 24h, 7d, 30d)
     - Blocked requests by IP
     - Blocked requests by path
     - Blocked requests by pattern type
   - Visualizations:
     - Time series of blocked requests
     - Top blocked IPs
     - Top blocked paths
     - Pattern distribution

   **Dashboard 2: Security Overview**
   - Metrics:
     - Rate limit violations
     - CSRF failures
     - Authentication failures
     - Error rate spikes
   - Visualizations:
     - Security events timeline
     - Event type distribution
     - Geographic distribution of attacks

5. **Configure Alerts**

   **Alert 1: High Spike in Blocked Requests**
   - Condition: > 100 blocked requests in 5 minutes
   - Severity: High
   - Notification: Security team, on-call engineer

   **Alert 2: React2Shell Pattern Detected**
   - Condition: Any request matching React2Shell signature
   - Severity: Critical
   - Notification: Security team immediately

   **Alert 3: Rate Limit Violations Spike**
   - Condition: > 50 rate limit violations in 5 minutes
   - Severity: Medium
   - Notification: Security team

   **Alert 4: Unusual Traffic Patterns**
   - Condition: > 10% increase in error rate
   - Severity: Medium
   - Notification: DevOps team

6. **Set Up Log Retention**
   - Retain security logs for minimum 90 days
   - Archive older logs for compliance (1 year+)
   - Ensure logs are immutable and tamper-proof

### Success Criteria

- ✅ Centralized logging configured
- ✅ All security events logged
- ✅ Dashboards created and accessible
- ✅ Alerts configured and tested
- ✅ Log retention policy in place

---

## Implementation Timeline

### Week 1-2: Setup and Monitoring
- Configure WAF rules in logging mode
- Set up centralized logging
- Create dashboards
- Configure initial alerts

### Week 3-4: Validation
- Monitor false positive rate
- Validate alert accuracy
- Tune rules based on findings
- Test blocking rules in staging

### Week 5-6: Production Deployment
- Enable blocking rules in production
- Monitor for issues
- Fine-tune as needed
- Document final configuration

---

## Required Access and Permissions

### WAF/CDN Configuration
- Access to CDN/WAF management console
- Permissions to create/modify rules
- Ability to view logs and metrics

### Logging Infrastructure
- Access to logging service (CloudWatch/ELK/etc.)
- Permissions to create dashboards
- Ability to configure alerts
- Access to log data for analysis

---

## Contacts

- **DevOps Team:** [devops@vitalcv.com]
- **Security Team:** [security@vitalcv.com]
- **Infrastructure Lead:** [infra-lead@vitalcv.com]

---

## References

- [Cloudflare WAF Rules](https://developers.cloudflare.com/waf/)
- [AWS WAF Documentation](https://docs.aws.amazon.com/waf/)
- [React2Shell CVE-2025-55182](https://cve.mitre.org/cgi-bin/cvename.cgi?name=CVE-2025-55182)

---

**Last Updated:** 2025-01-XX
**Status:** Pending Infrastructure Team Implementation

