package storage

import (
	"context"
	"testing"

	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
)

func TestUpyunGetDownloadURLPrefersCDNDomain(t *testing.T) {
	provider := NewUpyunProvider()
	policy := &model.StoragePolicy{
		Server: "https://v0.api.upyun.com",
		Settings: model.StoragePolicySettings{
			"cdn_domain": "https://cdn.example.com/",
		},
	}

	got, err := provider.GetDownloadURL(context.Background(), policy, "base/path/file name.jpg", DownloadURLOptions{})
	if err != nil {
		t.Fatalf("GetDownloadURL returned error: %v", err)
	}

	want := "https://cdn.example.com/base/path/file%20name.jpg"
	if got != want {
		t.Fatalf("GetDownloadURL = %q, want %q", got, want)
	}
}
