package volume

import (
	"testing"

	"github.com/anzhiyu-c/anheyu-app/pkg/constant"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
)

func TestPreserveMaskedStoragePolicySecrets(t *testing.T) {
	existing := &model.StoragePolicy{
		AccessKey: "old-operator",
		SecretKey: "old-password",
	}
	incoming := &model.StoragePolicy{
		AccessKey: "",
		SecretKey: constant.SecretValueMask,
	}

	preserveMaskedStoragePolicySecrets(incoming, existing)

	if incoming.AccessKey != existing.AccessKey {
		t.Fatalf("AccessKey = %q, want %q", incoming.AccessKey, existing.AccessKey)
	}
	if incoming.SecretKey != existing.SecretKey {
		t.Fatalf("SecretKey = %q, want %q", incoming.SecretKey, existing.SecretKey)
	}
}
