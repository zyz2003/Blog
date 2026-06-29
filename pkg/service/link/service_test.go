package link

import (
	"context"
	"errors"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/anzhiyu-c/anheyu-app/internal/pkg/event"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/repository"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/captcha"
)

type fakeLinkRepository struct {
	existsByURL        bool
	hasApplicant       bool
	deleteErrors       map[int]error
	created            bool
	createdEmail       string
	createdRssURL      string
	adminCreatedRssURL string
	updatedRssURL      string
	linkByID           *model.LinkDTO
	deletedIDs         []int
	applicantLookups   []string
}

func (f *fakeLinkRepository) Create(ctx context.Context, req *model.ApplyLinkRequest, categoryID int) (*model.LinkDTO, error) {
	f.created = true
	f.createdEmail = req.Email
	f.createdRssURL = req.RssURL
	return &model.LinkDTO{ID: 10, Name: req.Name, URL: req.URL, Email: req.Email, RssURL: req.RssURL}, nil
}

func (f *fakeLinkRepository) List(ctx context.Context, req *model.ListLinksRequest) ([]*model.LinkDTO, int, error) {
	return nil, 0, nil
}

func (f *fakeLinkRepository) ListPublic(ctx context.Context, req *model.ListPublicLinksRequest) ([]*model.LinkDTO, int, error) {
	return nil, 0, nil
}

func (f *fakeLinkRepository) UpdateStatus(ctx context.Context, id int, status string, siteshot *string) error {
	return nil
}

func (f *fakeLinkRepository) GetByID(ctx context.Context, id int) (*model.LinkDTO, error) {
	if f.linkByID != nil {
		return f.linkByID, nil
	}
	return &model.LinkDTO{ID: id}, nil
}

func (f *fakeLinkRepository) Update(ctx context.Context, id int, req *model.AdminUpdateLinkRequest) (*model.LinkDTO, error) {
	f.updatedRssURL = req.RssURL
	return &model.LinkDTO{ID: id, URL: req.URL, RssURL: req.RssURL}, nil
}

func (f *fakeLinkRepository) Delete(ctx context.Context, id int) error {
	f.deletedIDs = append(f.deletedIDs, id)
	if f.deleteErrors != nil {
		return f.deleteErrors[id]
	}
	return nil
}

func (f *fakeLinkRepository) AdminCreate(ctx context.Context, req *model.AdminCreateLinkRequest) (*model.LinkDTO, error) {
	f.adminCreatedRssURL = req.RssURL
	return &model.LinkDTO{ID: 1, URL: req.URL, RssURL: req.RssURL}, nil
}

func (f *fakeLinkRepository) GetRandomPublic(ctx context.Context, num int) ([]*model.LinkDTO, error) {
	return nil, nil
}

func (f *fakeLinkRepository) ExistsByURL(ctx context.Context, url string) (bool, error) {
	return f.existsByURL, nil
}

func (f *fakeLinkRepository) ExistsByURLAndCategory(ctx context.Context, url string, categoryID int) (bool, error) {
	return false, nil
}

func (f *fakeLinkRepository) GetByURL(ctx context.Context, url string) (*model.LinkDTO, error) {
	return nil, nil
}

func (f *fakeLinkRepository) GetAllApprovedLinks(ctx context.Context) ([]*model.LinkDTO, error) {
	return nil, nil
}

func (f *fakeLinkRepository) GetAllInvalidLinks(ctx context.Context) ([]*model.LinkDTO, error) {
	return nil, nil
}

func (f *fakeLinkRepository) BatchUpdateStatus(ctx context.Context, linkIDs []int, status string) error {
	return nil
}

func (f *fakeLinkRepository) BatchUpdateSortOrder(ctx context.Context, items []model.LinkSortItem) error {
	return nil
}

func (f *fakeLinkRepository) ListAllApplications(ctx context.Context, req *model.ListPublicLinksRequest) ([]*model.LinkDTO, int, error) {
	return nil, 0, nil
}

func (f *fakeLinkRepository) HasApplicationByEmail(ctx context.Context, email string) (bool, error) {
	f.applicantLookups = append(f.applicantLookups, email)
	return f.hasApplicant, nil
}

type fakeLinkCategoryRepository struct{}

func (fakeLinkCategoryRepository) Create(ctx context.Context, category *model.CreateLinkCategoryRequest) (*model.LinkCategoryDTO, error) {
	return &model.LinkCategoryDTO{ID: 2}, nil
}

func (fakeLinkCategoryRepository) FindAll(ctx context.Context) ([]*model.LinkCategoryDTO, error) {
	return nil, nil
}

func (fakeLinkCategoryRepository) FindAllWithLinks(ctx context.Context) ([]*model.LinkCategoryDTO, error) {
	return nil, nil
}

func (fakeLinkCategoryRepository) GetByID(ctx context.Context, id int) (*model.LinkCategoryDTO, error) {
	return &model.LinkCategoryDTO{ID: id, Style: "list"}, nil
}

func (fakeLinkCategoryRepository) DeleteIfUnused(ctx context.Context, categoryID int) (bool, error) {
	return true, nil
}

func (fakeLinkCategoryRepository) DeleteAllUnused(ctx context.Context) (int, error) {
	return 0, nil
}

func (fakeLinkCategoryRepository) DeleteAllUnusedExcluding(ctx context.Context, excludeIDs []int) (int, error) {
	return 0, nil
}

func (fakeLinkCategoryRepository) Update(ctx context.Context, id int, req *model.UpdateLinkCategoryRequest) (*model.LinkCategoryDTO, error) {
	return &model.LinkCategoryDTO{ID: id}, nil
}

func (fakeLinkCategoryRepository) GetByName(ctx context.Context, name string) (*model.LinkCategoryDTO, error) {
	return &model.LinkCategoryDTO{ID: 2, Name: name}, nil
}

type fakeLinkTagRepository struct{}

func (fakeLinkTagRepository) Create(ctx context.Context, tag *model.CreateLinkTagRequest) (*model.LinkTagDTO, error) {
	return &model.LinkTagDTO{ID: 1}, nil
}

func (fakeLinkTagRepository) FindAll(ctx context.Context) ([]*model.LinkTagDTO, error) {
	return nil, nil
}

func (fakeLinkTagRepository) DeleteIfUnused(ctx context.Context, tagIDs []int) (int64, error) {
	return 0, nil
}

func (fakeLinkTagRepository) DeleteAllUnused(ctx context.Context) (int, error) {
	return 0, nil
}

func (fakeLinkTagRepository) Update(ctx context.Context, id int, req *model.UpdateLinkTagRequest) (*model.LinkTagDTO, error) {
	return &model.LinkTagDTO{ID: id}, nil
}

func (fakeLinkTagRepository) GetByName(ctx context.Context, name string) (*model.LinkTagDTO, error) {
	return &model.LinkTagDTO{ID: 1, Name: name}, nil
}

type fakeSettingService struct{}

func (fakeSettingService) LoadAllSettings(ctx context.Context) error { return nil }
func (fakeSettingService) Get(key string) string                     { return "" }
func (fakeSettingService) GetBool(key string) bool                   { return false }
func (fakeSettingService) GetByKeys(keys []string) map[string]interface{} {
	return map[string]interface{}{}
}
func (fakeSettingService) GetSiteConfig() map[string]interface{} { return map[string]interface{}{} }
func (fakeSettingService) GetConfigVersion() int64               { return 0 }
func (fakeSettingService) UpdateSettings(ctx context.Context, settingsToUpdate map[string]string) error {
	return nil
}
func (fakeSettingService) RegisterPublicSettings(keys []string) {}
func (fakeSettingService) IsPublicSetting(key string) bool      { return false }

type fakeTaskBroker struct {
	cleanupCalls int
}

func (f *fakeTaskBroker) DispatchLinkCleanup() {
	f.cleanupCalls++
}

type fakeCaptchaService struct {
	err      error
	calls    int
	remoteIP string
}

func (f *fakeCaptchaService) GetProvider() captcha.CaptchaProvider {
	return captcha.ProviderImage
}

func (f *fakeCaptchaService) GetConfig() captcha.CaptchaConfig {
	return captcha.CaptchaConfig{Provider: captcha.ProviderImage}
}

func (f *fakeCaptchaService) GenerateImageCaptcha(ctx context.Context) (*captcha.ImageCaptchaResponse, error) {
	return nil, nil
}

func (f *fakeCaptchaService) Verify(ctx context.Context, params captcha.CaptchaParams, remoteIP string) error {
	f.calls++
	f.remoteIP = remoteIP
	return f.err
}

func (f *fakeCaptchaService) IsEnabled() bool { return true }

func newTestService(linkRepo *fakeLinkRepository, broker *fakeTaskBroker, captchaSvc captcha.CaptchaService) *service {
	return &service{
		linkRepo:         linkRepo,
		linkCategoryRepo: fakeLinkCategoryRepository{},
		linkTagRepo:      fakeLinkTagRepository{},
		txManager:        nil,
		broker:           broker,
		settingSvc:       fakeSettingService{},
		captchaSvc:       captchaSvc,
	}
}

func validApplyRequest(email string) *model.ApplyLinkRequest {
	return &model.ApplyLinkRequest{
		Type:        "NEW",
		Name:        "安知鱼",
		URL:         "https://blog.anheyu.com",
		Logo:        "https://blog.anheyu.com/logo.png",
		Description: "一个博客",
		Email:       email,
	}
}

func waitLinkEvent(t *testing.T, events <-chan LinkEventPayload) LinkEventPayload {
	t.Helper()
	select {
	case payload := <-events:
		return payload
	case <-time.After(2 * time.Second):
		t.Fatal("等待友链事件超时")
		return LinkEventPayload{}
	}
}

func TestApplyLinkRequiresCaptchaForRepeatApplicant(t *testing.T) {
	linkRepo := &fakeLinkRepository{hasApplicant: true}
	captchaSvc := &fakeCaptchaService{err: errors.New("请完成人机验证")}
	svc := newTestService(linkRepo, &fakeTaskBroker{}, captchaSvc)

	_, err := svc.ApplyLink(context.Background(), validApplyRequest("USER@example.com"), "203.0.113.10")

	if err == nil || !strings.Contains(err.Error(), "请完成人机验证") {
		t.Fatalf("ApplyLink() error = %v, want captcha error", err)
	}
	if linkRepo.created {
		t.Fatal("ApplyLink() created link for repeat applicant with invalid captcha")
	}
	if captchaSvc.calls != 1 {
		t.Fatalf("captcha Verify calls = %d, want 1", captchaSvc.calls)
	}
	if captchaSvc.remoteIP != "203.0.113.10" {
		t.Fatalf("captcha remoteIP = %q, want 203.0.113.10", captchaSvc.remoteIP)
	}
	if !reflect.DeepEqual(linkRepo.applicantLookups, []string{"user@example.com"}) {
		t.Fatalf("applicant lookups = %#v, want normalized email", linkRepo.applicantLookups)
	}
}

func TestApplyLinkSkipsCaptchaForFirstApplicant(t *testing.T) {
	linkRepo := &fakeLinkRepository{hasApplicant: false}
	captchaSvc := &fakeCaptchaService{err: errors.New("captcha should not be called")}
	svc := newTestService(linkRepo, &fakeTaskBroker{}, captchaSvc)

	got, err := svc.ApplyLink(context.Background(), validApplyRequest("first@example.com"), "203.0.113.10")
	if err != nil {
		t.Fatalf("ApplyLink() error = %v", err)
	}
	if got == nil || got.Email != "first@example.com" {
		t.Fatalf("ApplyLink() = %#v, want created link", got)
	}
	if captchaSvc.calls != 0 {
		t.Fatalf("captcha Verify calls = %d, want 0", captchaSvc.calls)
	}
	if !linkRepo.created {
		t.Fatal("ApplyLink() did not create link for first applicant")
	}
}

func TestApplyLinkPersistsCustomRSSURL(t *testing.T) {
	linkRepo := &fakeLinkRepository{hasApplicant: false}
	svc := newTestService(linkRepo, &fakeTaskBroker{}, nil)
	req := validApplyRequest("rss@example.com")
	req.RssURL = "https://blog.anheyu.com/atom.xml"

	got, err := svc.ApplyLink(context.Background(), req, "203.0.113.10")
	if err != nil {
		t.Fatalf("ApplyLink() error = %v", err)
	}

	if linkRepo.createdRssURL != req.RssURL {
		t.Fatalf("repository rss_url = %q, want %q", linkRepo.createdRssURL, req.RssURL)
	}
	if got.RssURL != req.RssURL {
		t.Fatalf("ApplyLink() RssURL = %q, want %q", got.RssURL, req.RssURL)
	}
}

func TestAdminCreateLinkPublishesCustomRSSURL(t *testing.T) {
	linkRepo := &fakeLinkRepository{}
	bus := event.NewEventBus()
	t.Cleanup(bus.Shutdown)
	events := make(chan LinkEventPayload, 1)
	bus.Subscribe(event.LinkCreated, func(payload interface{}) {
		if linkPayload, ok := payload.(LinkEventPayload); ok {
			events <- linkPayload
		}
	})

	svc := newTestService(linkRepo, &fakeTaskBroker{}, nil)
	svc.eventBus = bus
	req := &model.AdminCreateLinkRequest{
		Name:       "安知鱼",
		URL:        "https://blog.anheyu.com",
		CategoryID: 2,
		Status:     "APPROVED",
		RssURL:     "https://blog.anheyu.com/atom.xml",
	}

	if _, err := svc.AdminCreateLink(context.Background(), req); err != nil {
		t.Fatalf("AdminCreateLink() error = %v", err)
	}

	if linkRepo.adminCreatedRssURL != req.RssURL {
		t.Fatalf("repository rss_url = %q, want %q", linkRepo.adminCreatedRssURL, req.RssURL)
	}
	payload := waitLinkEvent(t, events)
	if payload.RssURL != req.RssURL {
		t.Fatalf("event rss_url = %q, want %q", payload.RssURL, req.RssURL)
	}
}

func TestAdminUpdateLinkPublishesCustomRSSURL(t *testing.T) {
	linkRepo := &fakeLinkRepository{}
	bus := event.NewEventBus()
	t.Cleanup(bus.Shutdown)
	events := make(chan LinkEventPayload, 1)
	bus.Subscribe(event.LinkUpdated, func(payload interface{}) {
		if linkPayload, ok := payload.(LinkEventPayload); ok {
			events <- linkPayload
		}
	})

	svc := newTestService(linkRepo, &fakeTaskBroker{}, nil)
	svc.eventBus = bus
	req := &model.AdminUpdateLinkRequest{
		Name:       "安知鱼",
		URL:        "https://blog.anheyu.com",
		CategoryID: 2,
		Status:     "APPROVED",
		RssURL:     "https://blog.anheyu.com/feed.xml",
	}

	if _, err := svc.AdminUpdateLink(context.Background(), 1, req); err != nil {
		t.Fatalf("AdminUpdateLink() error = %v", err)
	}

	if linkRepo.updatedRssURL != req.RssURL {
		t.Fatalf("repository rss_url = %q, want %q", linkRepo.updatedRssURL, req.RssURL)
	}
	payload := waitLinkEvent(t, events)
	if payload.RssURL != req.RssURL {
		t.Fatalf("event rss_url = %q, want %q", payload.RssURL, req.RssURL)
	}
}

func TestReviewLinkPublishesApprovedCustomRSSURL(t *testing.T) {
	linkRepo := &fakeLinkRepository{
		linkByID: &model.LinkDTO{
			ID:       7,
			Name:     "安知鱼",
			URL:      "https://blog.anheyu.com",
			RssURL:   "https://blog.anheyu.com/atom.xml",
			Category: &model.LinkCategoryDTO{ID: 2, Style: "list"},
		},
	}
	bus := event.NewEventBus()
	t.Cleanup(bus.Shutdown)
	events := make(chan LinkEventPayload, 1)
	bus.Subscribe(event.LinkCreated, func(payload interface{}) {
		if linkPayload, ok := payload.(LinkEventPayload); ok {
			events <- linkPayload
		}
	})

	svc := newTestService(linkRepo, &fakeTaskBroker{}, nil)
	svc.eventBus = bus

	if err := svc.ReviewLink(context.Background(), 7, &model.ReviewLinkRequest{Status: "APPROVED"}); err != nil {
		t.Fatalf("ReviewLink() error = %v", err)
	}

	payload := waitLinkEvent(t, events)
	if payload.LinkID != 7 {
		t.Fatalf("event LinkID = %d, want 7", payload.LinkID)
	}
	if payload.LinkURL != linkRepo.linkByID.URL {
		t.Fatalf("event LinkURL = %q, want %q", payload.LinkURL, linkRepo.linkByID.URL)
	}
	if payload.RssURL != linkRepo.linkByID.RssURL {
		t.Fatalf("event RssURL = %q, want %q", payload.RssURL, linkRepo.linkByID.RssURL)
	}
}

func TestBatchDeleteLinksReturnsItemLevelResult(t *testing.T) {
	linkRepo := &fakeLinkRepository{
		deleteErrors: map[int]error{
			2: errors.New("not found"),
		},
	}
	broker := &fakeTaskBroker{}
	svc := newTestService(linkRepo, broker, nil)

	got, err := svc.BatchDeleteLinks(context.Background(), &model.BatchDeleteLinksRequest{IDs: []int{1, 2, 3}})
	if err != nil {
		t.Fatalf("BatchDeleteLinks() error = %v", err)
	}

	if got.Total != 3 || got.Success != 2 || got.Failed != 1 {
		t.Fatalf("BatchDeleteLinks() = %#v, want total=3 success=2 failed=1", got)
	}
	if len(got.FailedList) != 1 || got.FailedList[0].ID != 2 || !strings.Contains(got.FailedList[0].Reason, "not found") {
		t.Fatalf("FailedList = %#v, want id=2 not found", got.FailedList)
	}
	if !reflect.DeepEqual(linkRepo.deletedIDs, []int{1, 2, 3}) {
		t.Fatalf("deleted IDs = %#v, want [1 2 3]", linkRepo.deletedIDs)
	}
	if broker.cleanupCalls != 1 {
		t.Fatalf("cleanup calls = %d, want 1", broker.cleanupCalls)
	}
}

func TestBatchDeleteLinksRejectsEmptyIDs(t *testing.T) {
	linkRepo := &fakeLinkRepository{}
	svc := newTestService(linkRepo, &fakeTaskBroker{}, nil)

	_, err := svc.BatchDeleteLinks(context.Background(), &model.BatchDeleteLinksRequest{})
	if err == nil || !strings.Contains(err.Error(), "至少选择一个友链") {
		t.Fatalf("BatchDeleteLinks() error = %v, want empty ids error", err)
	}
	if len(linkRepo.deletedIDs) != 0 {
		t.Fatalf("deleted IDs = %#v, want none", linkRepo.deletedIDs)
	}
}

var _ repository.LinkRepository = (*fakeLinkRepository)(nil)
