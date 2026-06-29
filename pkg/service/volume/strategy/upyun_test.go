package strategy

import (
	"testing"

	"github.com/anzhiyu-c/anheyu-app/pkg/constant"
)

func TestUpyunStrategyValidateSettingsDefaultsToServerUpload(t *testing.T) {
	settings := map[string]interface{}{
		"cdn_domain": "https://cdn.example.com",
	}

	strategy := NewUpyunStrategy()
	if err := strategy.ValidateSettings(settings); err != nil {
		t.Fatalf("ValidateSettings returned error: %v", err)
	}

	if got := settings[constant.UploadMethodSettingKey]; got != constant.UploadMethodServer {
		t.Fatalf("upload_method = %v, want %s", got, constant.UploadMethodServer)
	}
}

func TestUpyunStrategyRejectsClientUpload(t *testing.T) {
	settings := map[string]interface{}{
		constant.UploadMethodSettingKey: constant.UploadMethodClient,
	}

	strategy := NewUpyunStrategy()
	if err := strategy.ValidateSettings(settings); err == nil {
		t.Fatal("ValidateSettings should reject client upload")
	}
}
