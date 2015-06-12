/*
 * Copyright 2014 JBoss Inc
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package io.wittmann.jiralist.servlet;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import org.apache.commons.io.IOUtils;

/**
 * A proxy servlet used to get around cross-origin problems when pulling
 * down content from remote sites.
 *
 * @author eric.wittmann@redhat.com
 */
@SuppressWarnings("nls")
public class ProxyServlet extends HttpServlet {

    private static final long serialVersionUID = -4704803997251798191L;
    private static long requestCounter = 0;

    private static Set<String> EXCLUDE_HEADERS = new HashSet<String>();
    static {
        EXCLUDE_HEADERS.add("ETag");
        EXCLUDE_HEADERS.add("Last-Modified");
        EXCLUDE_HEADERS.add("Date");
        EXCLUDE_HEADERS.add("Cache-control");
        EXCLUDE_HEADERS.add("Transfer-Encoding");
    }

    /**
     * @see javax.servlet.http.HttpServlet#service(javax.servlet.http.HttpServletRequest, javax.servlet.http.HttpServletResponse)
     */
    @Override
    protected void service(HttpServletRequest req, HttpServletResponse resp) throws ServletException,
            IOException {
        long requestId = requestCounter++;

        String proxyTo = "https://issues.jboss.org/rest/api/2";
        if (req.getHeader("X-Proxy-To") != null) {
            proxyTo = req.getHeader("X-Proxy-To");
        }
        String url = proxyTo + req.getPathInfo();
        if (req.getQueryString() != null) {
            url += "?" + req.getQueryString();
        }

        System.out.println("["+requestId+"]: Proxying to: " + url);
        boolean isWrite = req.getMethod().equalsIgnoreCase("post") || req.getMethod().equalsIgnoreCase("put");

        URL remoteUrl = new URL(url);
        HttpURLConnection remoteConn = (HttpURLConnection) remoteUrl.openConnection();
        if (isWrite) {
            remoteConn.setDoOutput(true);
        }
        remoteConn.setRequestMethod(req.getMethod());

        String auth = req.getHeader("Authorization");
        if (auth != null) {
            remoteConn.setRequestProperty("Authorization", auth);
        }
        String ct = req.getHeader("Content-Type");
        if (ct != null) {
            remoteConn.setRequestProperty("Content-Type", ct);
        }
        String cl = req.getHeader("Content-Length");
        if (cl != null) {
            remoteConn.setRequestProperty("Content-Length", cl);
        }
        String accept = req.getHeader("Accept");
        if (accept != null) {
            remoteConn.setRequestProperty("Accept", accept);
        }

        System.out.println("["+requestId+"]: Request Info:");
        System.out.println("["+requestId+"]:     Method: " + req.getMethod());
        System.out.println("["+requestId+"]:     Has auth:   " + (auth != null));
        System.out.println("["+requestId+"]:     Content-Type: " + ct);
        System.out.println("["+requestId+"]:     Content-Length: " + cl);

        if (isWrite) {
            InputStream requestIS = null;
            OutputStream remoteOS = null;
            try {
                requestIS = req.getInputStream();
                remoteOS = remoteConn.getOutputStream();
                IOUtils.copy(requestIS, remoteOS);
                remoteOS.flush();
            } catch (Exception e) {
                e.printStackTrace();
                resp.sendError(500, e.getMessage());
                return;
            } finally {
                IOUtils.closeQuietly(requestIS);
                IOUtils.closeQuietly(remoteOS);
            }
        }

        InputStream remoteIS = null;
        OutputStream responseOS = null;
        int responseCode = remoteConn.getResponseCode();

        System.out.println("["+requestId+"]: Response Info:");
        System.out.println("["+requestId+"]:     Code: " + responseCode);

        if (responseCode == 400) {
            remoteIS = remoteConn.getInputStream();
            responseOS = System.out;
            IOUtils.copy(remoteIS, responseOS);
            IOUtils.closeQuietly(remoteIS);
            resp.sendError(400, "Error 400");
        } else {
            try {
                Map<String, List<String>> headerFields = remoteConn.getHeaderFields();
                for (String headerName : headerFields.keySet()) {
                    if (headerName == null) {
                        continue;
                    }
                    if (EXCLUDE_HEADERS.contains(headerName)) {
                        continue;
                    }
                    String headerValue = remoteConn.getHeaderField(headerName);
                    resp.setHeader(headerName, headerValue);
                    System.out.println("["+requestId+"]:     " + headerName + " : " + headerValue);
                }
                resp.setHeader("Cache-control", "no-cache, no-store, must-revalidate"); //$NON-NLS-2$
                remoteIS = remoteConn.getInputStream();
                responseOS = resp.getOutputStream();
                int bytesCopied = IOUtils.copy(remoteIS, responseOS);
                System.out.println("["+requestId+"]:     Bytes Proxied: " + bytesCopied);
                resp.flushBuffer();
            } catch (Exception e) {
                e.printStackTrace();
                resp.sendError(500, e.getMessage());
            } finally {
                IOUtils.closeQuietly(responseOS);
                IOUtils.closeQuietly(remoteIS);
            }
        }
    }

}
