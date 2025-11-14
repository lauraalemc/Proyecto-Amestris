package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"

	"amestris/backend/internal/async"
	"amestris/backend/internal/db"
	"amestris/backend/internal/models"
	"amestris/backend/internal/realtime"

	"github.com/gorilla/mux"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// ---------- DTOs / Requests ----------

type transmutationCreateReq struct {
	Title        string  `json:"title"`
	MaterialID   uint    `json:"materialId"`
	MissionID    *uint   `json:"missionId"`
	QuantityUsed float64 `json:"quantityUsed"`
	Result       *string `json:"result"`
}

type transmutationUpdateReq struct {
	Title     *string `json:"title"`
	MissionID *uint   `json:"missionId"`
	Result    *string `json:"result"`
}

type transmutationDTO struct {
	ID           uint    `json:"id"`
	Title        string  `json:"title"`
	MaterialID   uint    `json:"materialId"`
	MaterialName string  `json:"materialName,omitempty"`
	MissionID    *uint   `json:"missionId,omitempty"`
	MissionTitle string  `json:"missionTitle,omitempty"`
	QuantityUsed float64 `json:"quantityUsed"`
	Result       *string `json:"result,omitempty"`
	CreatedAt    string  `json:"createdAt"`
}

type transListResponse struct {
	Items    []transmutationDTO `json:"items"`
	Page     int                `json:"page"`
	PageSize int                `json:"pageSize"`
	Total    int64              `json:"total"`
}

const timeLayout = "2006-01-02T15:04:05Z07:00"

func toDTO(t models.Transmutation) transmutationDTO {
	dto := transmutationDTO{
		ID:           t.ID,
		Title:        t.Title,
		MaterialID:   t.MaterialID,
		QuantityUsed: t.QuantityUsed,
		Result:       t.Result,
		CreatedAt:    t.CreatedAt.Format(timeLayout),
	}
	if t.Material.ID != 0 {
		dto.MaterialName = t.Material.Name
	}
	if t.MissionID != nil && t.Mission.ID != 0 {
		dto.MissionTitle = t.Mission.Title
	}
	if t.MissionID != nil {
		dto.MissionID = t.MissionID
	}
	return dto
}

// ---------- LIST (paginación + filtro q) ----------

func TransmutationsList(w http.ResponseWriter, r *http.Request) {
	qp := r.URL.Query()

	page, _ := strconv.Atoi(qp.Get("page"))
	if page < 1 {
		page = 1
	}
	pageSize, _ := strconv.Atoi(qp.Get("pageSize"))
	if pageSize <= 0 || pageSize > 100 {
		pageSize = 10
	}
	search := strings.TrimSpace(qp.Get("q"))

	base := db.Get().Model(&models.Transmutation{})

	if search != "" {
		like := "%" + strings.ToLower(search) + "%"
		base = base.
			Joins("LEFT JOIN materials ON materials.id = transmutations.material_id").
			Joins("LEFT JOIN missions ON missions.id = transmutations.mission_id").
			Where(
				"LOWER(transmutations.title) LIKE ? OR LOWER(materials.name) LIKE ? OR LOWER(COALESCE(missions.title,'')) LIKE ?",
				like, like, like,
			)
	}

	var total int64
	if err := base.Count(&total).Error; err != nil {
		WriteError(w, http.StatusInternalServerError, "no se pudo contar transmutations")
		return
	}

	var rows []models.Transmutation
	if err := base.
		Preload("Material").
		Preload("Mission").
		Order("transmutations.id DESC").
		Limit(pageSize).
		Offset((page - 1) * pageSize).
		Find(&rows).Error; err != nil {
		WriteError(w, http.StatusInternalServerError, "no se pudo listar transmutations")
		return
	}

	out := make([]transmutationDTO, 0, len(rows))
	for _, t := range rows {
		out = append(out, toDTO(t))
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(transListResponse{
		Items:    out,
		Page:     page,
		PageSize: pageSize,
		Total:    total,
	})
}

// ---------- CREATE (transacción con control de stock) ----------

func TransmutationsCreate(w http.ResponseWriter, r *http.Request) {
	var in transmutationCreateReq
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		WriteError(w, http.StatusBadRequest, "json inválido")
		return
	}
	in.Title = strings.TrimSpace(in.Title)
	if in.Title == "" || in.MaterialID == 0 {
		WriteError(w, http.StatusBadRequest, "title y materialId son obligatorios")
		return
	}

	var created models.Transmutation

	err := db.Get().Transaction(func(tx *gorm.DB) error {
		var m models.Material
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&m, in.MaterialID).Error; err != nil {
			return err
		}
		if m.Quantity < in.QuantityUsed {
			return gorm.ErrInvalidData
		}
		m.Quantity = m.Quantity - in.QuantityUsed
		if err := tx.Save(&m).Error; err != nil {
			return err
		}
		t := models.Transmutation{
			Title:        in.Title,
			MaterialID:   in.MaterialID,
			MissionID:    in.MissionID,
			QuantityUsed: in.QuantityUsed,
			Result:       in.Result,
		}
		if err := tx.Create(&t).Error; err != nil {
			return err
		}
		created = t
		return nil
	})

	if err != nil {
		if err == gorm.ErrRecordNotFound {
			WriteError(w, http.StatusBadRequest, "materialId inexistente")
			return
		}
		if err == gorm.ErrInvalidData {
			WriteError(w, http.StatusConflict, "stock insuficiente")
			return
		}
		WriteError(w, http.StatusInternalServerError, "no se pudo crear transmutation")
		return
	}

	// Cargar relaciones para el DTO
	_ = db.Get().Preload("Material").Preload("Mission").First(&created, created.ID).Error
	dto := toDTO(created)

	// Auditoría async
	meta, _ := json.Marshal(map[string]any{
		"title":        created.Title,
		"materialId":   created.MaterialID,
		"missionId":    created.MissionID,
		"quantityUsed": created.QuantityUsed,
		"result":       created.Result,
		"createdAt":    time.Now().Format(time.RFC3339),
	})
	_ = async.EnqueueAudit(r.Context(), async.AuditPayload{
		Action:   "CREATE",
		Entity:   "transmutation",
		EntityID: created.ID,
		Meta:     meta,
	})

	// Evento SSE
	realtime.Publish(r.Context(), "transmutation.created", dto)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(dto)
}

// ---------- UPDATE (solo título, misión y resultado) ----------

func TransmutationsUpdate(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.Atoi(mux.Vars(r)["id"])

	var t models.Transmutation
	if err := db.Get().
		Preload("Material").
		Preload("Mission").
		First(&t, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			WriteError(w, http.StatusNotFound, "transmutation no existe")
			return
		}
		WriteError(w, http.StatusInternalServerError, "error cargando transmutation")
		return
	}

	var in transmutationUpdateReq
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		WriteError(w, http.StatusBadRequest, "json inválido")
		return
	}

	if in.Title != nil {
		title := strings.TrimSpace(*in.Title)
		if title == "" {
			WriteError(w, http.StatusBadRequest, "title no puede ser vacío")
			return
		}
		t.Title = title
	}
	if in.Result != nil {
		result := strings.TrimSpace(*in.Result)
		if result == "" {
			t.Result = nil
		} else {
			t.Result = &result
		}
	}
	if in.MissionID != nil {
		// Permitimos asignar / desasignar misión
		t.MissionID = in.MissionID
	}

	if err := db.Get().Save(&t).Error; err != nil {
		WriteError(w, http.StatusInternalServerError, "no se pudo actualizar transmutation")
		return
	}

	// Recargar relaciones
	_ = db.Get().Preload("Material").Preload("Mission").First(&t, t.ID).Error
	dto := toDTO(t)

	// Auditoría async
	meta, _ := json.Marshal(map[string]any{
		"id":        t.ID,
		"title":     t.Title,
		"missionId": t.MissionID,
		"result":    t.Result,
		"updatedAt": time.Now().Format(time.RFC3339),
	})
	_ = async.EnqueueAudit(r.Context(), async.AuditPayload{
		Action:   "UPDATE",
		Entity:   "transmutation",
		EntityID: t.ID,
		Meta:     meta,
	})

	// Evento SSE de actualización
	realtime.Publish(r.Context(), "transmutation.updated", dto)

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(dto)
}

// ---------- DELETE (restaura stock) ----------

func TransmutationsDelete(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.Atoi(mux.Vars(r)["id"])

	err := db.Get().Transaction(func(tx *gorm.DB) error {
		var t models.Transmutation
		if err := tx.Preload("Material").Preload("Mission").First(&t, id).Error; err != nil {
			return err
		}

		// Restaura el stock del material
		if t.MaterialID != 0 && t.QuantityUsed > 0 {
			if err := tx.Exec(
				"UPDATE materials SET quantity = quantity + ? WHERE id = ?",
				t.QuantityUsed, t.MaterialID,
			).Error; err != nil {
				return err
			}
		}

		if err := tx.Delete(&models.Transmutation{}, id).Error; err != nil {
			return err
		}
		return nil
	})

	if err != nil {
		if err == gorm.ErrRecordNotFound {
			WriteError(w, http.StatusNotFound, "transmutation no existe")
			return
		}
		WriteError(w, http.StatusInternalServerError, "no se pudo eliminar")
		return
	}

	// Auditoría
	meta, _ := json.Marshal(map[string]any{
		"id":        id,
		"deletedAt": time.Now().Format(time.RFC3339),
	})
	_ = async.EnqueueAudit(r.Context(), async.AuditPayload{
		Action:   "DELETE",
		Entity:   "transmutation",
		EntityID: uint(id),
		Meta:     meta,
	})

	// Evento SSE de eliminación
	realtime.Publish(r.Context(), "transmutation.deleted", map[string]any{
		"id": id,
	})

	w.WriteHeader(http.StatusNoContent)
}
