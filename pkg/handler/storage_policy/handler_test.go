package storage_policy_handler

import (
	"testing"

	"github.com/anzhiyu-c/anheyu-app/pkg/constant"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	"github.com/anzhiyu-c/anheyu-app/pkg/idgen"
)

func TestBuildStoragePolicyResponseItemMasksSecrets(t *testing.T) {
	if err := idgen.InitSqidsEncoderWithSeed("storage_policy_handler_test"); err != nil {
		t.Fatalf("InitSqidsEncoderWithSeed returned error: %v", err)
	}

	handler := NewStoragePolicyHandler(nil)
	policy := &model.StoragePolicy{
		ID:        1,
		Name:      "Upyun",
		Type:      constant.StoragePolicyType("upyun"),
		AccessKey: "operator",
		SecretKey: "plain-secret",
		Settings: model.StoragePolicySettings{
			"cdn_domain": "https://cdn.example.com",
		},
	}

	item, err := handler.buildStoragePolicyResponseItem(policy)
	if err != nil {
		t.Fatalf("buildStoragePolicyResponseItem returned error: %v", err)
	}

	if item.AccessKey == "operator" {
		t.Fatal("access_key should be masked in API responses")
	}
	if item.SecretKey == "plain-secret" {
		t.Fatal("secret_key should be masked in API responses")
	}
	if item.AccessKey == "" || item.SecretKey == "" {
		t.Fatal("masked secret fields should keep presence information")
	}
}
