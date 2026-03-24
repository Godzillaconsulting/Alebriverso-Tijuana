// Tijuana_EnemyBase_AI.cpp
// Arquitectura de IA Híbrida: N64 "Simple Pathing" + Modern Sensoring
// -------------------------------------------------------------------------
#include "TijuanaEnemyBase.h"
#include "Components/SphereComponent.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "Kismet/KismetMathLibrary.h"

// Estados Clásicos de IA N64
UENUM(BlueprintType)
enum class EEnemyState : uint8 {
    IDLE_ORBIT   UMETA(DisplayName = "Patrullaje N64"),
    ALERT        UMETA(DisplayName = "Alerta (Visual)"),
    CHASING      UMETA(DisplayName = "Persiguiendo (Moderno)"),
    RETURNING    UMETA(DisplayName = "Regresando al Origen"),
    STUNNED      UMETA(DisplayName = "Aturdido por Golpe")
};

ATijuanaEnemyBase::ATijuanaEnemyBase()
{
    PrimaryActorTick.bCanEverTick = true;
    
    // Componente de Detección de Área (El "Aggro" moderno)
    AggroSphere = CreateDefaultSubobject<USphereComponent>(TEXT("AggroSphere"));
    AggroSphere->SetupAttachment(RootComponent);
    AggroSphere->SetSphereRadius(850.f); // Rango de la chinampa
    AggroSphere->OnComponentBeginOverlap.AddDynamic(this, &ATijuanaEnemyBase::OnPlayerDetected);
    AggroSphere->OnComponentEndOverlap.AddDynamic(this, &ATijuanaEnemyBase::OnPlayerLost);

    CurrentState = EEnemyState::IDLE_ORBIT;
    OrbitRadius = 300.f;
    OrbitSpeed = 1.5f;
}

void ATijuanaEnemyBase::BeginPlay()
{
    Super::BeginPlay();
    SpawnOrigin = GetActorLocation(); // Ancla Matemática N64
}

void ATijuanaEnemyBase::Tick(float DeltaTime)
{
    Super::Tick(DeltaTime);

    // MÁQUINA DE ESTADOS LIGERA (Sin Behavior Tree)
    switch (CurrentState)
    {
        case EEnemyState::IDLE_ORBIT:
            ExecuteN64Orbit(DeltaTime);
            break;
            
        case EEnemyState::CHASING:
            ExecuteModernChase(DeltaTime);
            break;

        case EEnemyState::RETURNING:
            ExecuteReturnToSpawn(DeltaTime);
            break;
    }
}

// ----------------------------------------------------
// N64 MATH: Cero Costo de NavMesh (Goomba Style)
// ----------------------------------------------------
void ATijuanaEnemyBase::ExecuteN64Orbit(float DeltaTime)
{
    // Matemáticas trigonométricas puras en vez de Pathfinding
    float TimeSeconds = GetWorld()->GetTimeSeconds();
    float BaseX = SpawnOrigin.X + FMath::Cos(TimeSeconds * OrbitSpeed) * OrbitRadius;
    float BaseY = SpawnOrigin.Y + FMath::Sin(TimeSeconds * OrbitSpeed) * OrbitRadius;

    FVector NewPos(BaseX, BaseY, GetActorLocation().Z);
    FRotator FaceDirection = UKismetMathLibrary::FindLookAtRotation(GetActorLocation(), NewPos);

    SetActorLocation(NewPos);
    SetActorRotation(FMath::RInterpTo(GetActorRotation(), FaceDirection, DeltaTime, 5.0f));
}

// ----------------------------------------------------
// TRANSICIÓN MODERNA: Aggro
// ----------------------------------------------------
void ATijuanaEnemyBase::OnPlayerDetected(UPrimitiveComponent* OverlappedComp, AActor* OtherActor, ...)
{
    if (OtherActor->ActorHasTag("TijuanaProtagonist") && CurrentState == EEnemyState::IDLE_ORBIT)
    {
        TargetPlayer = OtherActor;
        CurrentState = EEnemyState::ALERT;
        
        // Efecto Visual / Sonido de alerta (ej: "!" de Metal Gear o Sonido N64)
        PlayAlertPling();
        
        // Micro-Pausa antes de atacar (Permite al jugador reaccionar)
        GetWorldTimerManager().SetTimer(AlertTimer, this, &ATijuanaEnemyBase::StartChasing, 0.4f, false);
    }
}

void ATijuanaEnemyBase::StartChasing()
{
    if (TargetPlayer) {
        CurrentState = EEnemyState::CHASING;
    }
}

void ATijuanaEnemyBase::ExecuteModernChase(float DeltaTime)
{
    if (!TargetPlayer) return;
    
    // Movimiento lineal simple hacia el jugador
    FVector Direction = (TargetPlayer->GetActorLocation() - GetActorLocation()).GetSafeNormal();
    Direction.Z = 0; // Evitar que vuele o se hunda

    AddMovementInput(Direction, 1.0f);
    
    // Girar a mirarlo
    FRotator FaceDirection = UKismetMathLibrary::FindLookAtRotation(GetActorLocation(), TargetPlayer->GetActorLocation());
    SetActorRotation(FMath::RInterpTo(GetActorRotation(), FaceDirection, DeltaTime, 8.0f));
}

void ATijuanaEnemyBase::OnPlayerLost(UPrimitiveComponent* OverlappedComp, AActor* OtherActor, ...)
{
    if (OtherActor == TargetPlayer)
    {
        TargetPlayer = nullptr;
        CurrentState = EEnemyState::RETURNING; // Regresar a su ancla N64
    }
}

void ATijuanaEnemyBase::ExecuteReturnToSpawn(float DeltaTime)
{
    FVector Direction = (SpawnOrigin - GetActorLocation()).GetSafeNormal();
    Direction.Z = 0;
    AddMovementInput(Direction, 0.7f); // Vuelve más lento

    // Si ya está muy cerca de su origen, reanuda el patrón circular
    if (FVector::DistXY(GetActorLocation(), SpawnOrigin) < 50.0f)
    {
        CurrentState = EEnemyState::IDLE_ORBIT;
    }
}
