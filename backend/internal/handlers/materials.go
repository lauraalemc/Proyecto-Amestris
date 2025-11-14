package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"amestris/backend/internal/async"
	"amestris/backend/internal/db"
	"amestris/backend/internal/models"

	"github.com/gorilla/mux"
	"gorm.io/gorm"
)

// ---------- LIST con paginación y filtro q ----------
type materialsListResponse[T any] struct {
	Items    []T   `json:"items"`
	Page     int   `json:"page"`
	PageSize int   `json:"pageSize"`
	Total    int64 `json:"total"`
}

// ---------- LIST ----------
func MaterialsList(w http.ResponseWriter, r *http.Request) {
	var items []models.Material

	// Ejemplo simple sin paginación; si ya tienes page/pageSize/total, úsalo.
	if err := db.Get().Order("id desc").Find(&items).Error; err != nil {
		WriteError(w, http.StatusInternalServerError, "no se pudo listar materiales")
		return
	}

	// Si tienes paginación real, reemplaza estos valores
	page := 1
	pageSize := len(items)
	var total int64 = int64(len(items))

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(materialsListResponse[models.Material]{
		Items:    items,
		Page:     page,
		PageSize: pageSize,
		Total:    total,
	})
}

// ---------- CREATE ----------
type materialCreateReq struct {
	Name     string  `json:"name"`
	Quantity float64 `json:"quantity"`
	Unit     string  `json:"unit"`
	Rarity   *string `json:"rarity"`
	Notes    *string `json:"notes"`
}

func MaterialsCreate(w http.ResponseWriter, r *http.Request) {
	var in materialCreateReq
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		WriteError(w, http.StatusBadRequest, "json inválido")
		return
	}
	in.Name = strings.TrimSpace(in.Name)
	in.Unit = strings.TrimSpace(in.Unit)
	if in.Name == "" || in.Unit == "" {
		WriteError(w, http.StatusBadRequest, "name y unit son obligatorios")
		return
	}
	m := models.Material{
		Name:     in.Name,
		Quantity: in.Quantity,
		Unit:     in.Unit,
		Rarity:   in.Rarity,
		Notes:    in.Notes,
	}
	if err := db.DB.Create(&m).Error; err != nil {
		WriteError(w, http.StatusInternalServerError, "no se pudo crear material")
		return
	}

	// --- Encolar auditoría (no bloquea la respuesta) ---
	meta := map[string]any{
		"name":     m.Name,
		"quantity": m.Quantity,
		"unit":     m.Unit,
		"rarity":   m.Rarity,
	}
	b, _ := json.Marshal(meta)
	_ = async.EnqueueAudit(r.Context(), async.AuditPayload{
		Action:   "CREATE",
		Entity:   "material",
		EntityID: m.ID,
		Meta:     b,
	})
	// ---------------------------------------------------

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(m)
}

// ---------- UPDATE ----------
type materialUpdateReq struct {
	Name     *string  `json:"name"`
	Quantity *float64 `json:"quantity"`
	Unit     *string  `json:"unit"`
	Rarity   *string  `json:"rarity"`
	Notes    *string  `json:"notes"`
}

func MaterialsUpdate(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.Atoi(mux.Vars(r)["id"])
	var m models.Material
	if err := db.DB.First(&m, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			WriteError(w, http.StatusNotFound, "material no existe")
			return
		}
		WriteError(w, http.StatusInternalServerError, "error consultando material")
		return
	}

	var in materialUpdateReq
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		WriteError(w, http.StatusBadRequest, "json inválido")
		return
	}

	if in.Name != nil {
		name := strings.TrimSpace(*in.Name)
		if name == "" {
			WriteError(w, http.StatusBadRequest, "name vacío")
			return
		}
		m.Name = name
	}
	if in.Quantity != nil {
		m.Quantity = *in.Quantity
	}
	if in.Unit != nil {
		unit := strings.TrimSpace(*in.Unit)
		if unit == "" {
			WriteError(w, http.StatusBadRequest, "unit vacía")
			return
		}
		m.Unit = unit
	}
	if in.Rarity != nil {
		m.Rarity = in.Rarity
	}
	if in.Notes != nil {
		m.Notes = in.Notes
	}

	if err := db.DB.Save(&m).Error; err != nil {
		WriteError(w, http.StatusInternalServerError, "no se pudo actualizar")
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(m)
}

// ---------- DELETE ----------
func MaterialsDelete(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.Atoi(mux.Vars(r)["id"])

	// Evita borrar si existen transmutations que lo usan
	var count int64
	if err := db.DB.Model(&models.Transmutation{}).Where("material_id = ?", id).Count(&count).Error; err == nil && count > 0 {
		WriteError(w, http.StatusConflict, "material usado en transmutations; no se puede borrar")
		return
	}

	if err := db.DB.Delete(&models.Material{}, id).Error; err != nil {
		WriteError(w, http.StatusInternalServerError, "no se pudo eliminar")
		return
	}

	// --- Encolar auditoría (no bloquea la respuesta) ---
	meta, _ := json.Marshal(map[string]any{"id": id})
	_ = async.EnqueueAudit(r.Context(), async.AuditPayload{
		Action:   "DELETE",
		Entity:   "material",
		EntityID: uint(id),
		Meta:     meta,
	})
	// ---------------------------------------------------

	w.WriteHeader(http.StatusNoContent)
}
