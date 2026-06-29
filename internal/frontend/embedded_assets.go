package frontend

import (
	"embed"
	"io/fs"
)

// embeddedFrontendFS contains generated Next.js standalone runtime assets.
//go:embed embedded_assets/runtime
var embeddedFrontendFS embed.FS

func embeddedRuntimeFS() (fs.FS, error) {
	return fs.Sub(embeddedFrontendFS, "embedded_assets/runtime")
}