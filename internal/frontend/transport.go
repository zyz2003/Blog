// Package frontend provides a shared HTTP transport optimized for reverse proxying
// to Next.js and SSR theme processes. This transport enables HTTP connection pooling
// and reuse across all proxy instances, dramatically reducing per-request latency.
package frontend

import (
	"crypto/tls"
	"net"
	"net/http"
	"time"
)

// SharedTransport returns a singleton http.Transport optimized for localhost
// reverse proxy scenarios. Key optimizations:
//   - Connection pooling with generous idle connection limits
//   - HTTP/2 support for multiplexed connections
//   - Aggressive keep-alive (no idle timeout below 90s)
//   - Short dial timeout (local services should respond instantly)
//
// Do NOT close this transport — it is shared across all proxy instances
// for the lifetime of the process.
var SharedTransport = newSharedTransport()

func newSharedTransport() *http.Transport {
	return &http.Transport{
		// Connection pooling
		MaxIdleConns:        100,
		MaxIdleConnsPerHost: 20,
		MaxConnsPerHost:     200,
		IdleConnTimeout:     90 * time.Second,

		// Keep-alive
		DisableKeepAlives: false,

		// Local connections — fast timeouts
		DialContext: (&net.Dialer{
			Timeout:   3 * time.Second,
			KeepAlive: 30 * time.Second,
		}).DialContext,

		// TLS is not used for localhost, but configure for external URLs
		TLSClientConfig: &tls.Config{
			MinVersion: tls.VersionTLS12,
		},

		// Response header timeout
		ResponseHeaderTimeout: 10 * time.Second,
		ExpectContinueTimeout: 1 * time.Second,

		// Enable HTTP/2
		ForceAttemptHTTP2: true,
	}
}
