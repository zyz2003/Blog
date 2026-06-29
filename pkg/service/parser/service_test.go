package parser

import (
	"context"
	"strings"
	"testing"

	"github.com/anzhiyu-c/anheyu-app/internal/pkg/event"
)

type stubSettingService struct{}

func (stubSettingService) LoadAllSettings(context.Context) error { return nil }
func (stubSettingService) Get(string) string                     { return "" }
func (stubSettingService) GetBool(string) bool                   { return false }
func (stubSettingService) GetByKeys([]string) map[string]interface{} {
	return map[string]interface{}{}
}
func (stubSettingService) GetSiteConfig() map[string]interface{} { return map[string]interface{}{} }
func (stubSettingService) GetConfigVersion() int64               { return 0 }
func (stubSettingService) UpdateSettings(context.Context, map[string]string) error {
	return nil
}
func (stubSettingService) RegisterPublicSettings([]string) {}
func (stubSettingService) IsPublicSetting(string) bool     { return false }

func TestSanitizeHTMLPreservesVideoGallerySource(t *testing.T) {
	bus := event.NewEventBus()
	t.Cleanup(bus.Shutdown)
	svc := NewService(stubSettingService{}, bus)

	html := `<div class="video-gallery-container video-gallery-cols-1">` +
		`<div class="video-gallery-item"><div class="video-gallery-video-wrapper">` +
		`<video class="video-gallery-video" controls preload="metadata" playsinline webkit-playsinline="true" x5-playsinline="true" x5-video-player-type="h5" src="/videos/demo.mp4" poster="/poster.jpg" onclick="alert(1)">` +
		`<source src="/videos/demo.mp4" type="video/mp4" onerror="alert(1)">` +
		`</video></div></div></div>`

	got := svc.SanitizeHTML(html)

	if !strings.Contains(got, `<source src="/videos/demo.mp4" type="video/mp4">`) {
		t.Fatalf("expected sanitized HTML to preserve video source, got: %s", got)
	}
	if !strings.Contains(got, `src="/videos/demo.mp4"`) {
		t.Fatalf("expected sanitized HTML to preserve video src attribute, got: %s", got)
	}
	for _, attr := range []string{`webkit-playsinline="true"`, `x5-playsinline="true"`, `x5-video-player-type="h5"`} {
		if !strings.Contains(got, attr) {
			t.Fatalf("expected sanitized HTML to preserve mobile video attribute %s, got: %s", attr, got)
		}
	}
	if strings.Contains(got, "onclick") || strings.Contains(got, "onerror") {
		t.Fatalf("expected sanitizer to remove event handlers, got: %s", got)
	}
}
